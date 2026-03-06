import { NextResponse } from "next/server";
import { getMergedProjects } from "../../../../lib/adminData";

export async function GET() {
  try {
    const projects = await getMergedProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
