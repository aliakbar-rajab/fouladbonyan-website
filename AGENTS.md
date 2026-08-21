# AGENTS.md — Bonyan Foulad Daria

This file should contain only durable, high-value guidance for working on `fouladbonyan.com`.

Treat the current repository state, configuration, and the user's latest instructions as more authoritative than stale documentation or historical assumptions.

## General Principles

- Sync with the latest remote state before making changes.

- If this file conflicts with the current repository or a newer user instruction, follow the current reality and update this file if appropriate.

- For mildly ambiguous requests, use reasonable judgment and proceed. Ask only when the ambiguity could materially change the outcome or direction of the work.

- If you discover additional issues while working, you may fix them as well. Avoid unnecessary or destructive changes to unrelated areas.

## Technical and Design Freedom

- Understand the current architecture, routing, page structure, and build system before changing them, but do not treat them as immutable.

- Refactor or replace weak, cumbersome, or outdated implementations when that improves the result.

- A weak section may be redesigned from scratch.

- You may also change surrounding layout or broader page structure when it materially improves UX or visual quality.

- Routes and URLs may be changed when beneficial, but handle redirects, existing links, and SEO consequences correctly.

- New dependencies are allowed when they are useful.

- Performance is not a primary project constraint. Do not weaken visual quality, interaction, animation, or UX merely to reduce JavaScript, bundle size, or rendering cost. Address performance when the site becomes genuinely slow, unstable, or annoying to use.

## Company Information and Content

- Keep shared company information such as brand name, phone numbers, addresses, and similar data centrally managed rather than unnecessarily hardcoding it in multiple places.

- Never invent business facts, legal information, registrations, licenses, company history, statistics, official email addresses, or similar factual claims.

- Check available project sources first. If an important business fact remains uncertain, ask the user.

- Copy, headlines, and page content may be rewritten freely when useful, but factual claims must remain accurate.

- Read `docs/agents/domain.md` only when the task actually depends on business/domain knowledge. Do not assume that file is current.

## Images and Media

- If a real photo exists for a product, project, or subject, preserve it rather than replacing it with stock or AI-generated imagery.

- When no real image exists, choose the most appropriate option for the case: stock photography, AI-generated imagery, illustration, abstract treatment, or graphic treatment.

- Media choices should support the credibility and overall visual quality of the site.

## Price Pages and SEO

- Prices must remain automatically updated. The current refresh cadence or implementation is not a fixed product requirement and may be changed when useful.

- Product and price pages may be restructured, rerouted, redesigned, or rendered differently as long as important price and product content remains crawlable and indexable.

- When changing pages or routes, verify relevant metadata, canonical URLs, sitemap output, internal links, and redirects.

- Discover the current sitemap/page-generation implementation from the repository instead of relying on historical notes. The important requirement is that the final output is correct.

## Price Data

- Do not dump large price-data files into context unnecessarily.

- When a task genuinely requires full-dataset analysis, you may process the entire dataset programmatically.

- Structural and semantic validation of price data must be preserved.

- Do not directly edit generated price data or other generated files as the source of truth. Update the relevant source, generator, or pipeline and regenerate the output.

## Testing and Verification

- Run tests and checks appropriate to the scope and risk of the change. A full verification suite is not required for every small change.

- Use broader verification for large, infrastructural, or high-risk changes.

- If an outdated test conflicts with new correct behavior, update or remove the outdated test instead of regressing the implementation merely to satisfy it.

- For UI changes, visually inspect the result in a browser.

- Check desktop, tablet, and mobile behavior for UI work, even when the original request focuses on only one viewport.

- Respect basic accessibility requirements such as readability, reasonable contrast, keyboard usability, and semantic structure without letting checklist compliance unnecessarily dominate design quality.

- Target modern mainstream browsers. Legacy-browser support is not a requirement.

## Git and Deployment

- Sync with the latest remote state before coding. Do not build new work on a stale checkout.

- The default workflow is direct work on `main` and direct push to `main`, unless the user explicitly requests another workflow for the task.

- Treat pushes to `main` as production-sensitive. Do not push incomplete or experimental work.

- If direct push is rejected by repository rules, you may create an appropriate branch and PR and continue through that workflow.

- Never use destructive operations such as `git reset --hard`, `git clean -fd`, or force push without explicit user instruction.

- If the working tree already contains unrelated changes, do not delete or overwrite them. Explain what is present and ask before modifying those changes if doing so is necessary. If your work can proceed safely without touching them, continue.

## Documentation

- Update documentation when your changes make existing documentation incorrect or misleading.

- Do not fill this file with fast-staling details such as exact file line counts, dated GitHub settings, temporary branch-protection state, or implementation trivia that can be inspected directly from the repository.

- GitHub Issues are not a required part of this project's workflow.

## Currently Nonessential Legacy Areas

- Quote, complaint, and payment-gateway-related forms/pages were largely introduced to satisfy payment-gateway requirements.

- They are not currently considered business-critical and should not be treated as permanent product constraints merely because they exist in the codebase.

- They may be removed, merged, simplified, or redesigned when that improves the product, unless the user gives task-specific instructions otherwise.

## Final Principle

The goal is not to preserve the current implementation.

The goal is to build the best possible version of the Bonyan Foulad Daria website while preserving factual accuracy, trustworthy real-world content, price-data integrity, and SEO.
