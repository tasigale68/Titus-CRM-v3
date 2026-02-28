# Cookbook Audit

## Description
Audit an Anthropic Cookbook notebook based on a rubric. Provides scoring across narrative quality, code quality, technical accuracy, and actionability. Use whenever a notebook review or audit is requested.

## Trigger
When asked to review or audit an Anthropic Cookbook notebook.

## Instructions

# Cookbook Audit

## Workflow

1. **Read the style guide**: First review `style_guide.md` to understand current best practices
2. **Identify the notebook**: Ask user for path if not provided
3. **Run automated checks**: Use `python3 validate_notebook.py <path>` to catch technical issues and generate markdown
   - The script automatically runs detect-secrets to scan for hardcoded API keys and credentials
4. **Review markdown output**: The script generates a markdown file in the `tmp/` folder for easier review
5. **Manual review**: Read through the markdown version evaluating against style guide and rubric
6. **Score each dimension**: Apply scoring guidelines objectively
7. **Generate report**: Follow the audit report format below
8. **Provide specific examples**: Show concrete improvements with line references

## Audit Report Format

### Executive Summary
- **Overall Score**: X/20
- **Key Strengths** (2-3 bullet points)
- **Critical Issues** (2-3 bullet points)

### Detailed Scoring

#### 1. Narrative Quality: X/5
[Brief justification with specific examples]

#### 2. Code Quality: X/5
[Brief justification with specific examples]

#### 3. Technical Accuracy: X/5
[Brief justification with specific examples]

#### 4. Actionability & Understanding: X/5
[Brief justification with specific examples]

### Specific Recommendations
[Prioritized, actionable list of improvements]

### Examples & Suggestions
[Specific excerpts with concrete suggestions]

## Quick Reference Checklist

**Introduction** (See style_guide.md Section 1)
- [ ] Hooks with the problem being solved (1-2 sentences)
- [ ] Explains why it matters (1-2 sentences)
- [ ] Lists learning objectives as bullet points (2-4 TLOs/ELOs)
- [ ] Focuses on value delivered, not machinery built

**Prerequisites & Setup** (See style_guide.md Section 2)
- [ ] Lists required knowledge clearly
- [ ] Uses %%capture for pip install to suppress output
- [ ] Uses dotenv.load_dotenv() not os.environ
- [ ] Defines MODEL constant at top
- [ ] Groups related installs in single command

**Structure & Organization**
- [ ] Has logical section progression
- [ ] Code blocks have explanatory text before them
- [ ] Includes what we learned after code blocks

**Conclusion** (See style_guide.md Section 4)
- [ ] Maps back to learning objectives
- [ ] Suggests ways to apply lessons to user's context
- [ ] Points to next steps or related resources

**Code Quality**
- [ ] No hardcoded API keys (automatically checked by detect-secrets)
- [ ] Meaningful variable names
- [ ] Comments explain "why" not "what"
- [ ] Model name defined as constant at top of notebook

**Technical Requirements**
- [ ] Executable without modification (except API keys)
- [ ] Uses non-deprecated API patterns
- [ ] Uses valid model names (claude-sonnet-4-6, claude-haiku-4-5, claude-opus-4-6)
- [ ] Uses non-dated model aliases

### Content Philosophy: Action + Understanding

Cookbooks are primarily action-oriented but strategically incorporate understanding. Core principles:
- **Practical focus**: Show users how to accomplish specific tasks with working code
- **Problem-first framing**: Lead with the problem being solved and value delivered
- **Builder's perspective**: Written from the user's point of view
- **Agency-building**: Help users understand why approaches work, not just how
- **Transferable knowledge**: Teach patterns that apply beyond the specific example
- **Critical thinking**: Encourage users to question outputs and make informed choices
- **Learning contracts**: State learning objectives upfront, map back in conclusions

### Common Anti-Patterns to Flag

**Introduction**: Leading with machinery, feature dumps, vague learning objectives
**Setup**: Noisy pip output, multiple separate installs, using os.environ, hardcoding model names
**Code**: Code blocks without explanatory text, no post-execution explanation
**Conclusion**: Generic summaries, not mapping back to learning objectives
