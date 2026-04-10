# MVP Architecture

## Objective

Create a repeatable system that can trigger lifecycle emails from a website, collect those emails, analyze them, and report what is working or broken.

The first website is Zillow, but the platform should stay site-agnostic.

## Core Principles

### 1. Separate identity from activity

An experiment identity should be created before any website interaction. Every run gets:

- a site name
- a scenario key
- a unique email alias
- a run identifier

This makes later attribution straightforward.

### 2. Keep scenarios deterministic

Instead of generic browsing, define a small scenario library per site. Deterministic actions make the resulting email stream easier to interpret.

### 3. Analyze with both rules and LLMs

Use lightweight deterministic checks first:

- send delay
- subject duplication
- unsubscribe presence
- broken links
- HTML/text balance
- obvious personalization mismatches

Then use an LLM to propose improvements:

- tone
- clarity
- relevance to user behavior
- missing urgency or value framing
- sequencing quality across multiple emails

## System Components

### Identity Service

Responsibilities:

- generate unique analysis email addresses
- choose routing policy by environment
- track which alias belongs to which run

Recommended modes:

- `custom-domain-catchall`: best long-term
- `gmail-plus-alias`: quick prototype
- `dedicated-inbox`: good for early manual verification

### Account Runner

Responsibilities:

- sign up for the site
- record credential metadata
- capture verification state

Output:

- `AccountProfile`
- signup timestamps
- first verification email expectations

### Scenario Runner

Responsibilities:

- execute site actions after signup
- emit normalized activity events
- remain deterministic enough for comparison across runs

For Zillow:

- set search market
- apply price and home-type filters
- view listings
- save homes
- save search

### Mail Ingester

Responsibilities:

- receive or fetch emails
- store raw MIME, parsed HTML, parsed text, links, and attachments
- normalize sender, subject, and timestamps

### Correlator

Responsibilities:

- connect incoming emails to account, run, and site actions
- label emails such as `verification`, `recommendation`, `digest`, `re-engagement`

### Analyzer

Responsibilities:

- compute metrics
- flag issues
- suggest improvements
- score whether each message matches the scenario

## Data Model

The essential entities are:

- `ExperimentIdentity`
- `AccountProfile`
- `ScenarioRun`
- `SiteAction`
- `EmailMessage`
- `EmailAnalysis`

## Early Metrics

- time to first email
- time to verification email
- emails per 24 hours and 7 days
- percentage of emails clearly attributable to a recent action
- subject line uniqueness
- percentage of emails with working primary CTA links
- average relevance score
- number of flagged issues per message

## Zillow Scenario Pack

### Scenario A: New user with focused browsing

- create account
- search for homes in a chosen market
- view 5 listings in a narrow price band
- save 2 listings
- save 1 search

Expected email categories:

- account verification
- saved search alerts
- recommendation or similar-home alerts
- possible re-engagement nudges

### Scenario B: Light return visit

- log back in the next day
- view 2 more homes
- change a price filter

Expected effect:

- more personalized recommendations
- possible refreshed alert content

## Email Address Recommendation

Preferred format:

`{site}.{scenario}.{runId}@signals.example.com`

Examples:

- `zillow.new-user.r001@signals.example.com`
- `zillow.return-visit.r002@signals.example.com`

This format supports:

- easy debugging
- automatic grouping by scenario
- future support for many websites

## Suggested MVP Stack

- Playwright for site activity
- Node/TypeScript for orchestration
- Postgres for durable experiment state
- object storage for raw emails and snapshots
- inbound email provider or Gmail API for ingestion

## Guardrails

- only automate accounts and interactions you are authorized to run
- do not design around bypassing CAPTCHAs or access controls
- avoid sending messages to real agents or sellers during testing unless that is explicitly approved

