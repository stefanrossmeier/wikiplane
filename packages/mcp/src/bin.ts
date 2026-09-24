#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createService } from '@wikiplane/cli/composition';
import { createWikiplaneMcpServer } from './server.js';

const configPath = process.env.WIKIPLANE_CONFIG ?? process.argv[2] ?? './wikiplane.yaml';
const service = await createService(configPath);
const server = createWikiplaneMcpServer(service);
await server.connect(new StdioServerTransport());
