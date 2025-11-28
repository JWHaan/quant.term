#!/usr/bin/env node

/**
 * Generate coverage-summary.json from coverage-final.json
 * This script converts vitest's coverage-final.json format to a summary format
 * that matches what coverage tools expect.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const coverageFinalPath = path.join(__dirname, '../coverage/coverage-final.json');
const coverageSummaryPath = path.join(__dirname, '../coverage/coverage-summary.json');

if (!fs.existsSync(coverageFinalPath)) {
    console.error(`Coverage file not found: ${coverageFinalPath}`);
    process.exit(1);
}

const coverageData = JSON.parse(fs.readFileSync(coverageFinalPath, 'utf8'));

// Calculate totals
let totalLines = 0;
let coveredLines = 0;
let totalStatements = 0;
let coveredStatements = 0;
let totalFunctions = 0;
let coveredFunctions = 0;
let totalBranches = 0;
let coveredBranches = 0;

const summary = {};

// Process each file
Object.keys(coverageData).forEach(filePath => {
    const file = coverageData[filePath];
    const statements = file.s || {};
    const functions = file.f || {};
    const branches = file.b || {};
    
    // Count statements
    const statementCount = Object.keys(statements).length;
    const coveredStatementCount = Object.values(statements).filter(count => count > 0).length;
    
    // Count functions
    const functionCount = Object.keys(functions).length;
    const coveredFunctionCount = Object.values(functions).filter(count => count > 0).length;
    
    // Count branches
    const branchCount = Object.values(branches).reduce((sum, branch) => {
        if (Array.isArray(branch)) {
            return sum + branch.length;
        }
        return sum;
    }, 0);
    const coveredBranchCount = Object.values(branches).reduce((sum, branch) => {
        if (Array.isArray(branch)) {
            return sum + branch.filter(count => count > 0).length;
        }
        return sum;
    }, 0);
    
    // Calculate lines (approximate from statements)
    const lines = statementCount;
    const fileCoveredLines = coveredStatementCount;
    
    // Calculate percentages
    const statementPct = statementCount > 0 ? (coveredStatementCount / statementCount) * 100 : 100;
    const functionPct = functionCount > 0 ? (coveredFunctionCount / functionCount) * 100 : 100;
    const branchPct = branchCount > 0 ? (coveredBranchCount / branchCount) * 100 : 100;
    const linePct = lines > 0 ? (fileCoveredLines / lines) * 100 : 100;
    
    // Add to totals
    totalStatements += statementCount;
    coveredStatements += coveredStatementCount;
    totalFunctions += functionCount;
    coveredFunctions += coveredFunctionCount;
    totalBranches += branchCount;
    coveredBranches += coveredBranchCount;
    totalLines += lines;
    coveredLines += fileCoveredLines;
    
    // Store file summary
    summary[filePath] = {
        lines: {
            total: lines,
            covered: fileCoveredLines,
            skipped: 0,
            pct: Math.round(linePct * 100) / 100
        },
        statements: {
            total: statementCount,
            covered: coveredStatementCount,
            skipped: 0,
            pct: Math.round(statementPct * 100) / 100
        },
        functions: {
            total: functionCount,
            covered: coveredFunctionCount,
            skipped: 0,
            pct: Math.round(functionPct * 100) / 100
        },
        branches: {
            total: branchCount,
            covered: coveredBranchCount,
            skipped: 0,
            pct: Math.round(branchPct * 100) / 100
        }
    };
});

// Calculate overall totals
const totalLinePct = totalLines > 0 ? (coveredLines / totalLines) * 100 : 100;
const totalStatementPct = totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 100;
const totalFunctionPct = totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 100;
const totalBranchPct = totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 100;

summary.total = {
    lines: {
        total: totalLines,
        covered: coveredLines,
        skipped: 0,
        pct: Math.round(totalLinePct * 100) / 100
    },
    statements: {
        total: totalStatements,
        covered: coveredStatements,
        skipped: 0,
        pct: Math.round(totalStatementPct * 100) / 100
    },
    functions: {
        total: totalFunctions,
        covered: coveredFunctions,
        skipped: 0,
        pct: Math.round(totalFunctionPct * 100) / 100
    },
    branches: {
        total: totalBranches,
        covered: coveredBranches,
        skipped: 0,
        pct: Math.round(totalBranchPct * 100) / 100
    }
};

// Write summary file
fs.writeFileSync(coverageSummaryPath, JSON.stringify(summary, null, 2), 'utf8');
console.log(`Coverage summary generated: ${coverageSummaryPath}`);

