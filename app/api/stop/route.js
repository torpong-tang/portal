import { stopProject } from '../../../lib/projectManager.mjs';
import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const { name } = await req.json();
        if (!name) return NextResponse.json({ error: 'Project name required' }, { status: 400 });
        const result = await stopProject(name);
        const message = result.stopped ? `Stopping ${name}` : `${name} is not running`;
        return NextResponse.json({ message });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
