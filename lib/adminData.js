import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { loadProjects, getRuntimeStatus, startProject, stopProject, clearRuntimeLogs } from "./projectManager.mjs";

const ADMIN_EMAIL = "torpong.t@gmail.com";
const ADMIN_PASSWORD = "torpong@123";
const hasDatabase = () => Boolean(process.env.DATABASE_URL);

// ---------------------------------------------------------------------------
// Health check cache — avoids firing 6 HTTP requests on every poll
// ---------------------------------------------------------------------------
const hc = globalThis;
if (!hc.__portalHealthCache) hc.__portalHealthCache = new Map();
const healthCache = hc.__portalHealthCache;
const HEALTH_TTL_MS = 10_000;

// ---------------------------------------------------------------------------
// In-memory store — persists across hot-reloads in dev (globalThis singleton)
// ---------------------------------------------------------------------------
const g = globalThis;
if (!g.__portalMemStore) {
  g.__portalMemStore = {
    configs: new Map(), // appName -> { showCard, desiredState, appGroup }
    visits: new Map(),  // appName -> { openCount, lastOpenedAt }
    logs: [],           // [{ id, appName, action, message, createdAt }]
    logSeq: 0,
  };
}
const mem = g.__portalMemStore;

const memLog = ({ appName = null, action, message }) => {
  mem.logs.unshift({ id: ++mem.logSeq, appName, action, message, createdAt: new Date() });
  if (mem.logs.length > 300) mem.logs.pop();
};

// ---------------------------------------------------------------------------

const checkAppHealth = async (appUrl) => {
  if (!appUrl) return false;

  const cached = healthCache.get(appUrl);
  if (cached && Date.now() - cached.ts < HEALTH_TTL_MS) return cached.healthy;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const res = await fetch(appUrl, {
      cache: "no-store",
      signal: controller.signal,
      redirect: "follow",
    });
    const healthy = res.status >= 200 && res.status < 400;
    healthCache.set(appUrl, { healthy, ts: Date.now() });
    return healthy;
  } catch {
    healthCache.set(appUrl, { healthy: false, ts: Date.now() });
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
};

const defaultConfigRows = (projects) =>
  projects.map((project) => ({
    appName: project.name,
    showCard: true,
    desiredState: "RUN",
    appGroup: project.group,
  }));

export const ensureAdminSeeded = async () => {
  if (!hasDatabase()) {
    throw new Error("DATABASE_URL is not configured");
  }
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.adminUser.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash },
    create: { email: ADMIN_EMAIL, passwordHash },
  });
};

export const ensureAppConfigsSeeded = async () => {
  const projects = await loadProjects();
  if (!projects.length) return projects;

  if (!hasDatabase()) {
    // Seed in-memory store with defaults for any new project
    for (const project of projects) {
      if (!mem.configs.has(project.name)) {
        mem.configs.set(project.name, {
          showCard: true,
          desiredState: "RUN",
          appGroup: project.group,
        });
      }
      if (!mem.visits.has(project.name)) {
        mem.visits.set(project.name, { openCount: 0, lastOpenedAt: null });
      }
    }
    return projects;
  }

  await prisma.appConfig.createMany({
    data: defaultConfigRows(projects),
    skipDuplicates: true,
  });

  await prisma.appVisitStat.createMany({
    data: projects.map((project) => ({ appName: project.name })),
    skipDuplicates: true,
  });

  return projects;
};

export const getMergedProjects = async () => {
  const projects = await ensureAppConfigsSeeded();
  const runtimeStatus = await getRuntimeStatus();
  const healthRows = await Promise.all(
    projects.map(async (project) => ({
      name: project.name,
      healthy: await checkAppHealth(project.appUrl),
    }))
  );
  const healthMap = new Map(healthRows.map((row) => [row.name, row.healthy]));

  if (!hasDatabase()) {
    return projects.map((project) => {
      const runtime = runtimeStatus[project.name] || {};
      const healthy = Boolean(healthMap.get(project.name));
      const running = Boolean(runtime.running) || healthy;
      const config = mem.configs.get(project.name) || {
        showCard: true,
        desiredState: "RUN",
        appGroup: project.group,
      };
      const visit = mem.visits.get(project.name) || { openCount: 0, lastOpenedAt: null };
      return {
        name: project.name,
        group: config.appGroup,
        appUrl: project.appUrl,
        running,
        message: running
          ? (runtime.message || "Running (detected by health check)")
          : "Not running",
        logs: runtime.logs || [],
        showCard: config.showCard,
        desiredState: config.desiredState,
        openCount: visit.openCount,
        lastOpenedAt: visit.lastOpenedAt,
      };
    });
  }

  const configs = await prisma.appConfig.findMany();
  const visits = await prisma.appVisitStat.findMany();

  const configMap = new Map(configs.map((item) => [item.appName, item]));
  const visitMap = new Map(visits.map((item) => [item.appName, item]));

  return projects.map((project) => {
    const runtime = runtimeStatus[project.name] || {};
    const healthy = Boolean(healthMap.get(project.name));
    const running = Boolean(runtime.running) || healthy;
    const config = configMap.get(project.name);
    const visit = visitMap.get(project.name);
    return {
      name: project.name,
      group: config?.appGroup || project.group,
      appUrl: project.appUrl,
      running,
      message: running
        ? (runtime.message || "Running (detected by health check)")
        : "Not running",
      logs: runtime.logs || [],
      showCard: config?.showCard ?? true,
      desiredState: config?.desiredState ?? "RUN",
      openCount: visit?.openCount ?? 0,
      lastOpenedAt: visit?.lastOpenedAt || null,
    };
  });
};

export const logAction = async ({ appName = null, action, message }) => {
  if (!hasDatabase()) {
    memLog({ appName, action, message });
    return;
  }
  await prisma.actionLog.create({
    data: { appName, action, message },
  });
};

export const setAppDesiredState = async ({ appName, desiredState }) => {
  if (hasDatabase()) {
    await prisma.appConfig.update({
      where: { appName },
      data: { desiredState },
    });
  } else {
    const current = mem.configs.get(appName) || {};
    mem.configs.set(appName, { ...current, desiredState });
  }

  if (desiredState === "RUN") {
    await startProject(appName);
    await logAction({ appName, action: "RUN", message: `Set ${appName} to RUN` });
  } else {
    await stopProject(appName);
    await logAction({ appName, action: "STOP", message: `Set ${appName} to STOP` });
  }
};

export const setShowCard = async ({ appName, showCard }) => {
  if (!hasDatabase()) {
    const current = mem.configs.get(appName) || {};
    mem.configs.set(appName, { ...current, showCard });
    await logAction({
      appName,
      action: "SHOW_CARD",
      message: `${showCard ? "Show" : "Hide"} card for ${appName}`,
    });
    return;
  }
  await prisma.appConfig.update({
    where: { appName },
    data: { showCard },
  });
  await logAction({
    appName,
    action: "SHOW_CARD",
    message: `${showCard ? "Show" : "Hide"} card for ${appName}`,
  });
};

export const setAppGroup = async ({ appName, group }) => {
  if (!hasDatabase()) {
    const current = mem.configs.get(appName) || {};
    mem.configs.set(appName, { ...current, appGroup: group });
    await logAction({
      appName,
      action: "GROUP",
      message: `Set ${appName} group to ${group}`,
    });
    return;
  }
  await prisma.appConfig.update({
    where: { appName },
    data: { appGroup: group },
  });
  await logAction({
    appName,
    action: "GROUP",
    message: `Set ${appName} group to ${group}`,
  });
};

export const trackOpen = async (appName) => {
  if (!hasDatabase()) {
    const current = mem.visits.get(appName) || { openCount: 0, lastOpenedAt: null };
    mem.visits.set(appName, { openCount: current.openCount + 1, lastOpenedAt: new Date() });
    await logAction({ appName, action: "OPEN", message: `Opened ${appName}` });
    return;
  }
  await prisma.appVisitStat.update({
    where: { appName },
    data: { openCount: { increment: 1 }, lastOpenedAt: new Date() },
  });
  await logAction({ appName, action: "OPEN", message: `Opened ${appName}` });
};

export const getDashboardSummary = async () => {
  const projects = await getMergedProjects();
  const actionLogs = hasDatabase()
    ? await prisma.actionLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 })
    : mem.logs.slice(0, 100);

  return {
    totalApps: projects.length,
    runningApps: projects.filter((item) => item.running).length,
    visibleApps: projects.filter((item) => item.showCard).length,
    totalOpenCount: projects.reduce((sum, item) => sum + item.openCount, 0),
    apps: projects,
    recentActions: actionLogs,
  };
};

export const getAdminLogs = async () => {
  const runtime = await getRuntimeStatus();
  const actionLogs = hasDatabase()
    ? await prisma.actionLog.findMany({ orderBy: { createdAt: "desc" }, take: 300 })
    : mem.logs.slice(0, 300);

  return {
    runtime,
    actionLogs,
  };
};

export const clearAllLogs = async () => {
  await clearRuntimeLogs();
  if (!hasDatabase()) {
    mem.logs = [];
    mem.logSeq = 0;
    return;
  }
  await prisma.actionLog.deleteMany();
};

export const verifyAdminLogin = async (email, password) => {
  if (!hasDatabase()) {
    // Memory-only mode: compare against hardcoded credentials directly
    return email === ADMIN_EMAIL && password === ADMIN_PASSWORD;
  }
  await ensureAdminSeeded();
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user) return false;
  return bcrypt.compare(password, user.passwordHash);
};

export const resetDefaultAppState = async () => {
  const projects = await ensureAppConfigsSeeded();
  const appNames = projects.map((project) => project.name);
  const groupByApp = new Map(projects.map((project) => [project.name, project.group]));

  if (!hasDatabase()) {
    for (const project of projects) {
      mem.configs.set(project.name, {
        showCard: true,
        desiredState: "RUN",
        appGroup: groupByApp.get(project.name) || "specific",
      });
    }
    for (const appName of appNames) {
      await startProject(appName);
    }
    await logAction({
      action: "RESET_DEFAULT_STATE",
      message: `Reset all ${appNames.length} applications to RUN + SHOW`,
    });
    return { count: appNames.length };
  }

  await prisma.$transaction(
    appNames.map((appName) =>
      prisma.appConfig.upsert({
        where: { appName },
        update: { desiredState: "RUN", showCard: true, appGroup: groupByApp.get(appName) || "specific" },
        create: {
          appName,
          desiredState: "RUN",
          showCard: true,
          appGroup: groupByApp.get(appName) || "specific",
        },
      })
    )
  );

  for (const appName of appNames) {
    await startProject(appName);
  }

  await logAction({
    action: "RESET_DEFAULT_STATE",
    message: `Reset all ${appNames.length} applications to RUN + SHOW`,
  });

  return { count: appNames.length };
};
