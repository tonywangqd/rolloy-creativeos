import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/config/prompts';

const CONFIG_FILE = path.join(process.cwd(), 'config', 'system-prompt.json');

// Ensure config directory exists
async function ensureConfigDir() {
  const configDir = path.dirname(CONFIG_FILE);
  try {
    await fs.access(configDir);
  } catch {
    await fs.mkdir(configDir, { recursive: true });
  }
}

// GET - Retrieve current system prompt
export async function GET() {
  try {
    await ensureConfigDir();

    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(data);
      return NextResponse.json({
        success: true,
        data: {
          systemPrompt: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
          isDefault: !config.systemPrompt,
          updatedAt: config.updatedAt || null,
        }
      });
    } catch {
      // File doesn't exist, return default
      return NextResponse.json({
        success: true,
        data: {
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
          isDefault: true,
          updatedAt: null,
        }
      });
    }
  } catch (error) {
    console.error('Failed to read system prompt:', error);
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to read system prompt' }
    }, { status: 500 });
  }
}

// POST - Update system prompt
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { systemPrompt } = body;

    if (typeof systemPrompt !== 'string') {
      return NextResponse.json({
        success: false,
        error: { message: 'systemPrompt must be a string' }
      }, { status: 400 });
    }

    await ensureConfigDir();

    const config = {
      systemPrompt: systemPrompt.trim() || null, // null means use default
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      data: {
        systemPrompt: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
        isDefault: !config.systemPrompt,
        updatedAt: config.updatedAt,
      }
    });
  } catch (error) {
    console.error('Failed to save system prompt:', error);
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to save system prompt' }
    }, { status: 500 });
  }
}

// DELETE - Reset to default
export async function DELETE() {
  try {
    await ensureConfigDir();

    try {
      await fs.unlink(CONFIG_FILE);
    } catch {
      // File doesn't exist, that's fine
    }

    return NextResponse.json({
      success: true,
      data: {
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        isDefault: true,
        updatedAt: null,
      }
    });
  } catch (error) {
    console.error('Failed to reset system prompt:', error);
    return NextResponse.json({
      success: false,
      error: { message: 'Failed to reset system prompt' }
    }, { status: 500 });
  }
}
