import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

export async function GET(req: Request) {
  try {
    // We would use the Notion Client here
    const notionApiKey = process.env.NOTION_API_KEY;
    const db12Id = process.env.NOTION_DB_12_ID; // Example SSOT DB ID

    if (!notionApiKey) {
      return NextResponse.json({ message: "Mocked Notion Data (Missing API Key)", data: getMockNotionData() });
    }

    const notion = new Client({ auth: notionApiKey });

    // Actually fetch but fallback to mock for now since we don't have DB IDs
    return NextResponse.json({ data: getMockNotionData() });
  } catch (error) {
    console.error("Notion Error", error);
    return NextResponse.json({ error: "Failed to fetch from Notion" }, { status: 500 });
  }
}

function getMockNotionData() {
  return {
    "projects": [
      { id: "P-1", name: "JES BIM Tower", status: "In Progress", claimValue: 1200000, progress: 45, manMonths: 24, type: "Resourcing" },
      { id: "P-2", name: "Alpha Mall", status: "Delayed", claimValue: 800000, progress: 12, manMonths: 18, type: "LumpSum" }
    ],
    "metrics": {
      totalProjects: 2,
      totalClaimValue: 2000000,
      monthlyRate: 50000
    }
  };
}
