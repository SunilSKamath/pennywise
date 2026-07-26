# Pennywise UI Architecture v1

## Vision

Pennywise should feel like:

* Apple Health
* Apple Wallet
* Linear
* Splitwise (simplicity only)

It should not feel like:

* QuickBooks
* Tally
* Enterprise dashboards
* Spreadsheet software

The primary interaction is recording expenses quickly.

The user should be able to record an expense in less than 5 seconds.

---

# Platform Strategy

## Phase 1

Single Frontend

```text
React PWA
```

Targets:

* iPhone
* iPad
* Mac Browser
* Android
* Desktop Browser

Single codebase.

Installable as a Progressive Web App.

---

# Design Principles

## Mobile First

Design starts at:

```text
390px width
```

Everything scales upward.

Never design desktop first.

---

## Fast Entry

Adding an expense is the most important flow.

Every design decision should optimize:

```text
Open App
↓
Add Expense
↓
Save
```

---

## Minimal Navigation

Maximum four primary destinations.

```text
Home
Expenses
Add
Settings
```

Insights can be embedded in Home initially.

---

## No Dashboard Syndrome

Avoid:

* 20 charts
* Large tables
* Analytics-heavy landing pages

Focus on:

* Current spending
* Recent expenses
* Quick actions

---

# Tech Stack

## Framework

React 19

## Language

TypeScript

Strict mode enabled.

---

## Build Tool

Vite

---

## Styling

Tailwind CSS

Reason:

* AI generates Tailwind extremely well
* Fast iteration
* No CSS architecture overhead

---

## Components

shadcn/ui

Reason:

* Excellent defaults
* Accessible
* Modern appearance
* Easy customization

---

## Data Fetching

TanStack Query

Responsibilities:

* API caching
* Request retries
* Loading states
* Mutations

---

## Forms

React Hook Form

Validation:

Zod

---

## State Management

Zustand

Only for:

* User session
* Theme
* App preferences

No Redux.

---

## Routing

React Router

---

## Charts

Recharts

Only after Phase 1.

---

# Design System

## Typography

Font:

```text
Inter
```

Scale:

```text
Heading XL
Heading L
Body
Caption
```

No custom typography system.

---

## Spacing

8-point grid.

```text
4
8
16
24
32
48
```

---

## Corner Radius

```text
16px
```

for cards.

```text
12px
```

for controls.

---

## Shadows

Minimal.

Prefer borders over shadows.

---

## Theme

### Light Mode

Primary experience.

### Dark Mode

Supported.

Automatic device detection.

---

# Layout Architecture

## Mobile

Bottom navigation.

```text
Home
Expenses
Add
Settings
```

Persistent.

---

## Tablet

Sidebar.

```text
Home
Expenses
Add
Settings
```

Left aligned.

---

## Desktop

Sidebar layout.

Content centered.

Maximum width:

```text
1200px
```

---

# Screens

## Home

Purpose:

Quick financial snapshot.

Components:

* Monthly spend card
* Category summary
* Recent expenses

No charts above the fold.

---

## Expense List

Purpose:

Review and search expenses.

Features:

* Search
* Date filters
* Infinite scrolling

Grouping:

```text
Today
Yesterday
This Month
```

---

## Add Expense

Most important screen.

Fields:

```text
Amount
Category
Payment Source
Merchant
Notes
Date
Currency
```

Primary CTA:

```text
Save Expense
```

Large touch target.

---

## Settings

Contains:

* Profile
* Categories
* Payment Sources
* Currency Settings
* Theme

No advanced administration.

---

# Component Library

## Required Components

Button

Input

Currency Input

Card

Select

Bottom Sheet

Modal

Date Picker

Toast

Avatar

Loading Skeleton

Empty State

---

# UX Guidelines

## Loading

Always show skeletons.

Never show blank screens.

---

## Empty States

Every screen must have:

```text
No Expenses Yet
Add Your First Expense
```

style empty states.

---

## Errors

Human language.

Bad:

```text
Validation Failed
```

Good:

```text
Please enter an amount.
```

---

## Performance Targets

First Load:

< 2 seconds

Screen Navigation:

Instant

Expense Creation:

< 300ms perceived latency

---

# Future UI Features

Phase 2

* Quick Add
* Smart Merchant Suggestions
* Recurring Expenses

Phase 3

* AI Categorization
* Receipt Scanning
* Gmail Import

Phase 4

* Financial Insights
* Spending Trends
* Net Worth Dashboard

The UI architecture should remain simple enough that new features are added as cards and workflows, not as entirely new navigation structures.
