// lib/projectManager.mjs — shared state for running projects
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectsFile = '/home/johnson/projects/portal/projects.json';

// Singleton map — persists across API calls in the same server process
const running = global.__portalRunning ?? (global.__portalRunning = new Map());

export const loadProjects = async () => {
    const raw = await fs.readFile(projectsFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
};

const addLog = (record, chunk) => {
    const lines = chunk.toString('utf8').replace(/\r/g, '').split('\n').filter(Boolean);
    for (const line of lines) {
        record.logs.push(line);
        const m = line.match(/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{2,5})?(?:\/[^\s]*)?/i);
        if (m) record.detectedUrl = m[0];
    }
    if (record.logs.length > 40) record.logs.splice(0, record.logs.length - 40);
};

export const getRuntimeStatus = async () => {
    const projects = await loadProjects();
    const status = {};
    for (const project of projects) {
        const item = running.get(project.name);
        if (!item) {
            status[project.name] = { running: false, message: 'Not running', logs: [], error: false, appUrl: project.appUrl || null, group: project.group };
            continue;
        }
        status[project.name] = {
            running: !item.exited,
            message: item.exited ? `Exited (code ${item.exitCode ?? 0})` : `Running (pid ${item.process.pid})`,
            logs: item.logs,
            error: Boolean(item.exitCode && item.exitCode !== 0),
            appUrl: project.appUrl || item.detectedUrl || null,
            group: project.group,
        };
    }
    return status;
};

export const startProject = async (name) => {
    const projects = await loadProjects();
    const project = projects.find((p) => p.name === name);
    if (!project) throw new Error(`Unknown project: ${name}`);

    const existing = running.get(name);
    if (existing && !existing.exited) {
        return { alreadyRunning: true, pid: existing.process.pid, appUrl: project.appUrl || existing.detectedUrl || null };
    }

    const child = spawn('bash', ['-lc', project.runCommand], {
        cwd: '/home/johnson/projects',
        env: process.env,
        detached: true,
    });

    const record = { process: child, logs: [], exitCode: null, exited: false, detectedUrl: null };
    running.set(name, record);
    child.stdout?.on('data', (c) => addLog(record, c));
    child.stderr?.on('data', (c) => addLog(record, c));
    child.on('close', (code) => { record.exitCode = code; record.exited = true; });

    return { alreadyRunning: false, pid: child.pid, appUrl: project.appUrl || null };
};

export const stopProject = async (name) => {
    const item = running.get(name);
    if (!item || item.exited) return { stopped: false };
    const pid = item.process.pid;
    if (!pid) return { stopped: false };
    try { process.kill(-pid, 'SIGTERM'); } catch { item.process.kill('SIGTERM'); }
    setTimeout(() => {
        if (item.exited) return;
        try { process.kill(-pid, 'SIGKILL'); } catch { item.process.kill('SIGKILL'); }
    }, 4000);
    return { stopped: true };
};
