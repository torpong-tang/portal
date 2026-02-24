import { getRuntimeStatus } from '../../../lib/projectManager.mjs';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const status = await getRuntimeStatus();
        return NextResponse.json(status);
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
