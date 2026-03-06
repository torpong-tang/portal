import { startProject } from '../../../lib/projectManager.mjs';
import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const { name } = await req.json();
        if (!name) return NextResponse.json({ error: 'Project name required' }, { status: 400 });
        const result = await startProject(name);
        const message = result.alreadyRunning
            ? `${name} is already running (pid ${result.pid})`
            : `Started ${name} (pid ${result.pid})`;
        return NextResponse.json({ message, appUrl: result.appUrl });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
