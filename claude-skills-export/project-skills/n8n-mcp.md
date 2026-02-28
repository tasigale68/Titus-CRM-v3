# n8n MCP

## Description
Comprehensive documentation and knowledge server that provides AI assistants with complete access to n8n node information through the Model Context Protocol (MCP). Serves as a bridge between n8n's workflow automation platform and AI models.

## Trigger
When working with n8n workflow automation, MCP server development, or node information retrieval.

## Instructions

# n8n-mcp Project Guide

## Project Overview

n8n-mcp is a comprehensive documentation and knowledge server that provides AI assistants with complete access to n8n node information through the Model Context Protocol (MCP). It serves as a bridge between n8n's workflow automation platform and AI models, enabling them to understand and work with n8n nodes effectively.

### Current Architecture:
```
src/
├── loaders/
│   └── node-loader.ts         # NPM package loader for both packages
├── parsers/
│   ├── node-parser.ts         # Enhanced parser with version support
│   └── property-extractor.ts  # Dedicated property/operation extraction
├── mappers/
│   └── docs-mapper.ts         # Documentation mapping with fixes
├── database/
│   ├── schema.sql             # SQLite schema
│   ├── node-repository.ts     # Data access layer
│   └── database-adapter.ts    # Universal database adapter
├── services/
│   ├── property-filter.ts     # Filters properties to essentials
│   ├── example-generator.ts   # Generates working examples
│   ├── task-templates.ts      # Pre-configured node settings
│   ├── config-validator.ts    # Configuration validation
│   ├── enhanced-config-validator.ts # Operation-aware validation
│   ├── node-specific-validators.ts  # Node-specific validation logic
│   ├── property-dependencies.ts # Dependency analysis
│   ├── type-structure-service.ts # Type structure validation
│   ├── expression-validator.ts # n8n expression syntax validation
│   └── workflow-validator.ts  # Complete workflow validation
├── templates/
│   ├── template-fetcher.ts    # Fetches templates from n8n.io API
│   ├── template-repository.ts # Template database operations
│   └── template-service.ts    # Template business logic
├── mcp/
│   ├── server.ts              # MCP server with enhanced tools
│   ├── tools.ts               # Tool definitions
│   ├── tools-documentation.ts # Tool documentation system
│   └── index.ts               # Main entry point with mode selection
└── index.ts                   # Library exports
```

## Common Development Commands

```bash
npm run build          # Build TypeScript
npm run rebuild        # Rebuild node database from n8n packages
npm run validate       # Validate all node data
npm test               # Run all tests
npm run test:unit      # Run unit tests only
npm run lint           # Check TypeScript types
npm start              # Start MCP server in stdio mode
npm run start:http     # Start MCP server in HTTP mode
npm run dev            # Build, rebuild database, and validate
```

## High-Level Architecture

### Core Components

1. **MCP Server** - Implements Model Context Protocol for AI assistants
2. **Database Layer** - SQLite with universal adapter pattern and FTS5 search
3. **Node Processing Pipeline** - Loader -> Parser -> Property Extractor -> Docs Mapper
4. **Service Layer** - Property Filter, Config Validator, Type Structure Service, Expression/Workflow Validators
5. **Template System** - Fetches and stores workflow templates from n8n.io

### Key Design Patterns

1. **Repository Pattern**: All database operations go through repository classes
2. **Service Layer**: Business logic separated from data access
3. **Validation Profiles**: Different strictness levels (minimal, runtime, ai-friendly, strict)
4. **Diff-Based Updates**: Efficient workflow updates using operation diffs

### Development Reminders
- When making changes to MCP server, ask user to reload before testing
- Use GH CLI to get issues and comments when reviewing
- Divide subtasks into separate sub-agents for parallel handling
- Run typecheck and lint after every code change
- Use `get_node_essentials()` instead of `get_node_info()` for faster responses
- Sub-agents are not allowed to spawn further sub-agents
