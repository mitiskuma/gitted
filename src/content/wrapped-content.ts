// src/content/wrapped-content.ts

import { WrappedSlideType } from '@/lib/types';
import type { WrappedContentTemplates } from '@/lib/types';

/**
 * Content templates for the Wrapped slideshow experience.
 * Inspired by Spotify Wrapped and git-wrapped.com — generates beautiful
 * visualizations of your GitHub activity across all selected repositories.
 *
 * Placeholders use {curlyBrace} syntax and are replaced at render time
 * with real analytics data from the useAnalytics/useWrappedSlideshow hooks.
 */

export const wrappedContentTemplates: WrappedContentTemplates = {
  // =========================================================================
  // SLIDE TITLES — Main headline for each wrapped slide
  // =========================================================================
  slideTitles: {
    [WrappedSlideType.INTRO]: "Your {year} in Code",
    [WrappedSlideType.TOP_REPOS]: "Your Top Repositories",
    [WrappedSlideType.PRODUCTIVITY]: "Your Productivity Profile",
    [WrappedSlideType.LANGUAGE_EVOLUTION]: "Your Language Journey",
    [WrappedSlideType.STREAKS]: "Your Coding Streaks",
    [WrappedSlideType.MONTHLY_BREAKDOWN]: "Month by Month",
    [WrappedSlideType.YEARLY_COMPARISON]: "Year Over Year",
    [WrappedSlideType.SUPERLATIVES]: "Your Dev Superlatives",
    [WrappedSlideType.FINAL_SUMMARY]: "That's a Wrap, {username}!",
  },

  // =========================================================================
  // SLIDE SUBTITLES — Descriptive subtext with stat placeholders
  // =========================================================================
  slideSubtitles: {
    [WrappedSlideType.INTRO]:
      "You made {totalCommits} commits across {totalRepos} repositories. Let's dive into the story your code tells.",
    [WrappedSlideType.TOP_REPOS]:
      "Your #1 repo was {topRepoName} with {topRepoCommits} commits — that's {topRepoPercentage}% of your total activity.",
    [WrappedSlideType.PRODUCTIVITY]:
      "Your most productive day was {mostProductiveDay}. On average, you shipped {avgCommitsPerDay} commits per active day.",
    [WrappedSlideType.LANGUAGE_EVOLUTION]:
      "You wrote code in {totalLanguages} languages this year. {topLanguage} dominated with {topLanguagePercentage}% of your codebase.",
    [WrappedSlideType.STREAKS]:
      "Your longest streak was {longestStreak} consecutive days of commits — from {streakStart} to {streakEnd}.",
    [WrappedSlideType.MONTHLY_BREAKDOWN]:
      "{peakMonth} was your peak month with {peakMonthCommits} commits. Some months you were on fire 🔥",
    [WrappedSlideType.YEARLY_COMPARISON]:
      "Compared to last year, your commits {growthDirection} by {commitGrowthPercentage}%. {growthEmoji}",
    [WrappedSlideType.SUPERLATIVES]:
      "You're a certified {chronotype}. {weekendPercentage}% of your commits happened on weekends.",
    [WrappedSlideType.FINAL_SUMMARY]:
      "{totalCommits} commits. {totalAdditions} lines added. {totalDeletions} lines deleted. {activeDays} active days. This was your year.",
  },

  // =========================================================================
  // SUPERLATIVE LABELS — Fun awards and personality traits
  // =========================================================================
  superlativeLabels: {
    // Chronotype superlatives
    "night-owl": "🦉 Night Owl",
    "early-bird": "🐦 Early Bird",
    "balanced": "⚖️ Perfectly Balanced",

    // Weekend behavior
    "weekend-warrior": "⚔️ Weekend Warrior",
    "weekday-warrior": "💼 Weekday Warrior",
    "balanced-week": "🌗 All-Week Coder",

    // Commit style
    "micro-committer": "🔬 Micro-Committer",
    "mega-committer": "🏔️ Mega-Committer",
    "balanced-committer": "📦 Balanced Committer",

    // Productivity awards
    "streak-master": "🔥 Streak Master",
    "consistency-king": "👑 Consistency Monarch",
    "burst-coder": "⚡ Burst Coder",
    "marathon-coder": "🏃 Marathon Coder",
    "sprint-coder": "💨 Sprint Coder",

    // Code volume awards
    "line-machine": "🏭 Line Machine",
    "code-minimalist": "✨ Code Minimalist",
    "refactor-champion": "♻️ Refactor Champion",
    "feature-factory": "🏗️ Feature Factory",
    "bug-squasher": "🐛 Bug Squasher",

    // Collaboration
    "merge-master": "🔀 Merge Master",
    "solo-artist": "🎸 Solo Artist",

    // Language mastery
    "polyglot": "🌐 Polyglot Developer",
    "specialist": "🎯 Language Specialist",
    "typescript-devotee": "💙 TypeScript Devotee",
    "python-enthusiast": "🐍 Python Enthusiast",
    "rust-evangelist": "🦀 Rust Evangelist",

    // Time-based
    "midnight-coder": "🌙 Midnight Coder",
    "dawn-patrol": "🌅 Dawn Patrol",
    "lunch-break-hacker": "🥪 Lunch Break Hacker",
    "after-hours-hero": "🌃 After-Hours Hero",

    // Commit message style
    "verbose-documenter": "📝 Verbose Documenter",
    "one-liner-legend": "⚡ One-Liner Legend",
    "emoji-enthusiast": "😎 Emoji Enthusiast",
    "conventional-committer": "📋 Conventional Committer",

    // Repository awards
    "repo-explorer": "🗺️ Repo Explorer",
    "deep-diver": "🤿 Deep Diver",
    "project-starter": "🚀 Project Starter",
    "maintainer-extraordinaire": "🔧 Maintainer Extraordinaire",

    // Volume milestones
    "centurion": "💯 Centurion (100+ commits)",
    "millennium": "🏆 Millennium Coder (1000+ commits)",
    "ten-k-club": "🌟 10K Club (10,000+ commits)",

    // Fun/misc
    "fix-it-felix": "🔨 Fix-It Felix",
    "wip-warrior": "🚧 WIP Warrior",
    "init-commit-champion": "🎬 Init Commit Champion",
    "readme-writer": "📖 README Writer",
    "config-tweaker": "⚙️ Config Tweaker",

    // Mood-based
    "positive-committer": "😊 Positive Committer",
    "neutral-committer": "😐 Neutral Committer",
    "frustrated-fixer": "😤 Frustrated Fixer",

    // Most used commit word
    "favorite-word": "💬 Favorite Commit Word: \"{word}\" ({count} times)",
  },

  // =========================================================================
  // SHARE TEXT TEMPLATES — For social sharing via Web Share API
  // =========================================================================
  shareTextTemplates: {
    [WrappedSlideType.INTRO]:
      "🎉 My {year} Git Wrapped is here! {totalCommits} commits across {totalRepos} repos. See your story at gitted.dev #GitWrapped #gitted",
    [WrappedSlideType.TOP_REPOS]:
      "🏆 My top repo in {year} was {topRepoName} with {topRepoCommits} commits! What's yours? gitted.dev #GitWrapped #gitted",
    [WrappedSlideType.PRODUCTIVITY]:
      "📊 I averaged {avgCommitsPerDay} commits per active day in {year}. My most productive day? {mostProductiveDay}. gitted.dev #GitWrapped #gitted",
    [WrappedSlideType.LANGUAGE_EVOLUTION]:
      "💻 I coded in {totalLanguages} languages this year. {topLanguage} took the crown at {topLanguagePercentage}%. gitted.dev #GitWrapped #gitted",
    [WrappedSlideType.STREAKS]:
      "🔥 My longest coding streak in {year}: {longestStreak} days straight! Can you beat that? gitted.dev #GitWrapped #gitted",
    [WrappedSlideType.MONTHLY_BREAKDOWN]:
      "📅 {peakMonth} was my coding peak with {peakMonthCommits} commits. What was your best month? gitted.dev #GitWrapped #gitted",
    [WrappedSlideType.YEARLY_COMPARISON]:
      "📈 My commits {growthDirection} by {commitGrowthPercentage}% compared to last year. {growthEmoji} gitted.dev #GitWrapped #gitted",
    [WrappedSlideType.SUPERLATIVES]:
      "🦉 I'm a certified {chronotype} coder! {weekendPercentage}% of my commits were on weekends. gitted.dev #GitWrapped #gitted",
    [WrappedSlideType.FINAL_SUMMARY]:
      "🎬 That's a wrap on {year}! {totalCommits} commits, {totalAdditions} lines added, {activeDays} active days. Get your Git Wrapped at gitted.dev #GitWrapped #gitted",
  },

  // =========================================================================
  // FUN FACTS TEMPLATES — Random facts shown between slides or as extras
  // =========================================================================
  funFacts: [
    // Volume facts
    "If each of your {totalCommits} commits were a step, you'd have walked {commitSteps} meters. That's {commitStepsComparison}!",
    "You added {totalAdditions} lines of code this year. Printed out, that's roughly {printedPages} pages of code.",
    "You deleted {totalDeletions} lines. Good code is deleted code — that's {deletionPercentage}% of your total changes.",
    "Your net contribution was {netLines} lines. You're a {netLinesLabel}!",

    // Time facts
    "Your earliest commit was at {earliestCommitTime}. {earlyBirdComment}",
    "Your latest commit was at {latestCommitTime}. {nightOwlComment}",
    "You committed on {activeDays} out of {totalDays} days — that's a {activityPercentage}% activity rate.",
    "{mostActiveHour}:00 was your most productive hour. That's when the magic happened.",
    "You coded through {weekendCount} weekends this year. {weekendComment}",

    // Streak facts
    "Your longest streak of {longestStreak} days means you committed code for {streakWeeks} straight weeks.",
    "During your best streak, you averaged {streakAvgCommits} commits per day. Relentless.",
    "You had {totalStreaks} coding streaks of 3+ days this year.",

    // Language facts
    "TypeScript made up {tsPercentage}% of your code. The type system thanks you.",
    "You touched {totalLanguages} different programming languages. Talk about being versatile!",
    "Your most niche language was {nicheLang} — only {nichePercentage}% of your code, but hey, it counts.",

    // Repository facts
    "Your most active repo saw {topRepoCommits} commits — that's {topRepoDaily} commits per day on average.",
    "You created {newRepos} new repositories this year. The world needed them.",
    "Your oldest active repo is {oldestRepoAge} old and still getting commits. Respect.",

    // Commit message facts
    "Your most common commit word was \"{favoriteWord}\" — you used it {favoriteWordCount} times.",
    "Your longest commit message was {longestMessageLength} characters. {longMessageComment}",
    "Your shortest commit message was \"{shortestMessage}\". We've all been there.",
    "{fixPercentage}% of your commits contained \"fix\". Bugs happen to the best of us.",
    "{featPercentage}% of your commits were features. You're building the future.",
    "You wrote {mergeCount} merge commits. Collaboration is key.",

    // Comparison facts
    "With {totalCommits} commits, you outpaced {percentileRank}% of developers on gitted.",
    "Your {totalAdditions} lines added is equivalent to writing {novelEquivalent} novels worth of text.",
    "If your commits were songs, you'd have released {albumCount} albums this year.",

    // Day-specific facts
    "Your busiest single day was {busiestDate} with {busiestDayCommits} commits. What happened?!",
    "{dayOfWeek}s are your day. You made {dayOfWeekCommits} commits on {dayOfWeek}s alone.",
    "You made {nightCommits} commits between midnight and 6 AM. Sleep is overrated, apparently.",

    // File facts
    "You modified {uniqueFiles} unique files across all repos. That's a lot of file tabs.",
    "Your most-edited file was {mostEditedFile} with {mostEditedCount} modifications.",
    "You worked with {fileExtensionCount} different file types. Jack of all extensions.",

    // Seasonal facts
    "Q{bestQuarter} was your best quarter with {bestQuarterCommits} commits.",
    "{bestSeason} was your season — {bestSeasonCommits} commits when {seasonComment}.",
    "January you made {janCommits} commits. December you made {decCommits}. {yearProgressComment}",

    // Meta facts
    "This analysis processed {totalDataPoints} data points to build your story. You're worth it.",
    "Your git history spans {historyDays} days. That's {historyYears} years of code evolution.",
    "Across all repos, you had {uniqueContributors} unique collaborators. Team player!",

    // Emoji/fun
    "If every commit earned you $1, you'd have ${totalCommits}. Invest in coffee ☕",
    "Your commit graph would make a {graphShape} if you squinted hard enough.",
    "You averaged one commit every {avgTimeBetweenCommits}. That's your coding heartbeat.",
    "Your code changes this year weigh approximately {codeWeight}KB in diff size. Heavy lifting!",
  ],
};

// =============================================================================
// HELPER: Intro narrative variations based on commit volume
// =============================================================================

export const introNarratives = {
  /** < 100 commits */
  low: [
    "Quality over quantity — every commit counted.",
    "You were deliberate and intentional with your code this year.",
    "Focused contributions that made a difference.",
  ],
  /** 100–500 commits */
  medium: [
    "A solid year of consistent coding.",
    "You showed up and shipped. That's what matters.",
    "Steady and impactful — the mark of a professional.",
  ],
  /** 500–1000 commits */
  high: [
    "You were on a roll this year. Seriously impressive.",
    "Hundreds of commits, thousands of lines — you were in the zone.",
    "This was a defining year for your development journey.",
  ],
  /** 1000–5000 commits */
  veryHigh: [
    "You basically lived in your terminal this year.",
    "Over a thousand commits. You didn't just write code — you sculpted software.",
    "The sheer volume of your contributions is staggering.",
  ],
  /** 5000+ commits */
  legendary: [
    "Are you even human? This output is legendary.",
    "Thousands upon thousands of commits. You're a force of nature.",
    "Your git log reads like an epic novel. Multiple volumes.",
  ],
} as const;

// =============================================================================
// HELPER: Get narrative tier based on commit count
// =============================================================================

export function getIntroNarrativeTier(totalCommits: number): keyof typeof introNarratives {
  if (totalCommits < 100) return 'low';
  if (totalCommits < 500) return 'medium';
  if (totalCommits < 1000) return 'high';
  if (totalCommits < 5000) return 'veryHigh';
  return 'legendary';
}

export function getRandomIntroNarrative(totalCommits: number): string {
  const tier = getIntroNarrativeTier(totalCommits);
  const narratives = introNarratives[tier];
  return narratives[Math.floor(Math.random() * narratives.length)];
}

// =============================================================================
// SUPERLATIVE DESCRIPTIONS — Extended descriptions for badge tooltips
// =============================================================================

export const superlativeDescriptions: Record<string, string> = {
  "night-owl":
    "You do your best work when the rest of the world is asleep. Most of your commits land after 8 PM. The terminal glow is your nightlight.",
  "early-bird":
    "While others are still hitting snooze, you're already pushing code. Most of your commits happen before 9 AM. Dawn is your deployment window.",
  "balanced":
    "You code across all hours — no single time of day dominates. A true all-rounder.",
  "weekend-warrior":
    "Weekends aren't for rest — they're for shipping. A significant chunk of your commits happen on Saturdays and Sundays.",
  "weekday-warrior":
    "Monday through Friday, you're locked in. Your weekends are commit-free zones (mostly).",
  "streak-master":
    "Your ability to commit code day after day is unmatched. Long streaks are your superpower.",
  "consistency-king":
    "You don't have huge spikes — you have steady, reliable output. Every week, every month.",
  "burst-coder":
    "When inspiration strikes, you go all in. Your commit history shows intense bursts of activity.",
  "polyglot":
    "You don't stick to one language — you're fluent in many. Your repos span multiple ecosystems.",
  "specialist":
    "You know your language and you know it well. Deep expertise over broad exploration.",
  "fix-it-felix":
    "A significant portion of your commits contain 'fix'. You're the one who keeps things running.",
  "feature-factory":
    "You're all about building new things. 'feat' and 'feature' appear frequently in your commits.",
  "refactor-champion":
    "You care about code quality. Refactoring is a regular part of your workflow.",
  "micro-committer":
    "Small, atomic commits — each one does exactly one thing. Clean git history is your art form.",
  "mega-committer":
    "When you commit, you commit BIG. Large changesets are your signature move.",
  "line-machine":
    "The sheer volume of lines you produce is staggering. You're a productivity machine.",
  "code-minimalist":
    "Less is more. You achieve a lot with remarkably few lines of code.",
  "merge-master":
    "You bring branches together like a conductor unites an orchestra. Merge commits are your rhythm.",
  "solo-artist":
    "You work independently and effectively. Your repositories are largely your own creation.",
  "wip-warrior":
    "'WIP' appears in your commits more than most. You're comfortable with work-in-progress transparency.",
  "readme-writer":
    "You touch README files frequently. Documentation matters, and you know it.",
};

// =============================================================================
// GROWTH DIRECTION HELPERS — For year-over-year slide text
// =============================================================================

export const growthDirectionText = {
  increased: {
    direction: "grew",
    emoji: "📈",
    comment: "You leveled up!",
  },
  decreased: {
    direction: "decreased",
    emoji: "📉",
    comment: "Quality over quantity, right?",
  },
  stable: {
    direction: "stayed steady",
    emoji: "📊",
    comment: "Consistency is key.",
  },
} as const;

export function getGrowthDirection(
  percentage: number
): keyof typeof growthDirectionText {
  if (percentage > 5) return "increased";
  if (percentage < -5) return "decreased";
  return "stable";
}

// =============================================================================
// CHRONOTYPE DESCRIPTIONS — Extended for the superlatives slide
// =============================================================================

export const chronotypeDescriptions = {
  "night-owl": {
    title: "Night Owl 🦉",
    tagline: "Your peak hours are when the moon is up",
    description:
      "The majority of your commits happen in the evening and late night hours. You thrive in the quiet, focused hours when distractions fade away.",
    peakWindow: "8 PM – 2 AM",
    funFact:
      "Fun fact: Some of the most impactful code in history was written at night. You're in good company.",
  },
  "early-bird": {
    title: "Early Bird 🐦",
    tagline: "First commit before first coffee",
    description:
      "You start coding early in the morning, often before most people are awake. Your freshest ideas come with the sunrise.",
    peakWindow: "5 AM – 10 AM",
    funFact:
      "Early morning code tends to have fewer bugs — your brain is freshest at dawn.",
  },
  balanced: {
    title: "Balanced Coder ⚖️",
    tagline: "No hour is off limits",
    description:
      "Your commits are spread evenly across the day. You don't conform to one pattern — you code whenever inspiration strikes.",
    peakWindow: "Varies",
    funFact:
      "Balanced coders are often the most adaptable team members. Flex scheduling is your superpower.",
  },
} as const;

// =============================================================================
// WEEKEND TYPE DESCRIPTIONS
// =============================================================================

export const weekendTypeDescriptions = {
  "weekend-warrior": {
    title: "Weekend Warrior ⚔️",
    tagline: "Saturday and Sunday are just two more days to ship",
    description:
      "You don't take weekends off from coding. Whether it's side projects or catching up on work, your weekends are productive.",
  },
  "weekday-warrior": {
    title: "Weekday Warrior 💼",
    tagline: "Work hard, rest harder",
    description:
      "You keep your coding to business hours (mostly). Weekends are for recharging so you can ship harder Monday through Friday.",
  },
  balanced: {
    title: "All-Week Coder 🌗",
    tagline: "Every day is a good day to code",
    description:
      "Your commit distribution across weekdays and weekends is fairly even. You code when the mood strikes, regardless of the day.",
  },
} as const;

// =============================================================================
// SEASON COMMENTARY — For seasonal fun facts
// =============================================================================

export const seasonCommentary: Record<string, string> = {
  spring: "the flowers were blooming and so was your code",
  summer: "the sun was out but you were in — shipping features",
  fall: "leaves were falling and commits were rising",
  winter: "it was cold outside but your commits were fire",
};

// =============================================================================
// COMMIT MESSAGE MOOD LABELS
// =============================================================================

export const commitMoodLabels: Record<string, { label: string; emoji: string; description: string }> = {
  positive: {
    label: "Positive Vibes",
    emoji: "😊",
    description: "Your commit messages lean positive — lots of 'add', 'improve', 'enhance', and 'feat'. You're building great things!",
  },
  neutral: {
    label: "All Business",
    emoji: "😐",
    description: "Your commit messages are straightforward and professional. No fluff, just facts.",
  },
  negative: {
    label: "Bug Hunter",
    emoji: "🐛",
    description: "Your commits frequently mention 'fix', 'bug', 'issue', and 'error'. You're the one keeping the lights on!",
  },
};

// =============================================================================
// BADGE TEMPLATES — Pre-defined achievement badges
// =============================================================================

export const badgeTemplates: Record<string, {
  name: string;
  description: string;
  icon: string;
  criteria: string;
}> = {
  centurion: {
    name: "Centurion",
    description: "Made 100+ commits in a year",
    icon: "💯",
    criteria: "totalCommits >= 100",
  },
  millennium: {
    name: "Millennium Coder",
    description: "Made 1,000+ commits in a year",
    icon: "🏆",
    criteria: "totalCommits >= 1000",
  },
  tenKClub: {
    name: "10K Club",
    description: "Made 10,000+ commits in a year",
    icon: "🌟",
    criteria: "totalCommits >= 10000",
  },
  weekStreak: {
    name: "Full Week",
    description: "Committed every day for a full week",
    icon: "📅",
    criteria: "longestStreak >= 7",
  },
  monthStreak: {
    name: "Monthly Marathon",
    description: "Committed every day for 30+ days",
    icon: "🏃",
    criteria: "longestStreak >= 30",
  },
  hundredDayStreak: {
    name: "Century Streak",
    description: "Committed every day for 100+ days",
    icon: "🔥",
    criteria: "longestStreak >= 100",
  },
  yearStreak: {
    name: "Year of Code",
    description: "Committed every day for 365 days",
    icon: "👑",
    criteria: "longestStreak >= 365",
  },
  polyglot: {
    name: "Polyglot",
    description: "Used 5+ programming languages",
    icon: "🌐",
    criteria: "totalLanguages >= 5",
  },
  hyperPolyglot: {
    name: "Hyper-Polyglot",
    description: "Used 10+ programming languages",
    icon: "🗺️",
    criteria: "totalLanguages >= 10",
  },
  nightOwl: {
    name: "Night Owl",
    description: "50%+ of commits between 8 PM and 4 AM",
    icon: "🦉",
    criteria: "nightCommitPercentage >= 50",
  },
  earlyBird: {
    name: "Early Bird",
    description: "50%+ of commits between 5 AM and 9 AM",
    icon: "🐦",
    criteria: "earlyCommitPercentage >= 50",
  },
  weekendWarrior: {
    name: "Weekend Warrior",
    description: "30%+ of commits on weekends",
    icon: "⚔️",
    criteria: "weekendPercentage >= 30",
  },
  fixItFelix: {
    name: "Fix-It Felix",
    description: "25%+ of commits contain 'fix'",
    icon: "🔨",
    criteria: "fixPercentage >= 25",
  },
  featureFactory: {
    name: "Feature Factory",
    description: "25%+ of commits contain 'feat' or 'feature'",
    icon: "🏗️",
    criteria: "featurePercentage >= 25",
  },
  refactorChamp: {
    name: "Refactor Champion",
    description: "10%+ of commits contain 'refactor'",
    icon: "♻️",
    criteria: "refactorPercentage >= 10",
  },
  lineSlinger: {
    name: "Line Slinger",
    description: "Added 50,000+ lines of code",
    icon: "📜",
    criteria: "totalAdditions >= 50000",
  },
  codeCleaner: {
    name: "Code Cleaner",
    description: "Deleted more lines than added",
    icon: "🧹",
    criteria: "totalDeletions > totalAdditions",
  },
  multiRepo: {
    name: "Repo Explorer",
    description: "Active in 5+ repositories",
    icon: "🗺️",
    criteria: "activeRepos >= 5",
  },
  megaRepo: {
    name: "Mega Repository",
    description: "Active in 20+ repositories",
    icon: "🌌",
    criteria: "activeRepos >= 20",
  },
  busiestDay: {
    name: "Shipping Frenzy",
    description: "Made 20+ commits in a single day",
    icon: "🚀",
    criteria: "maxCommitsInDay >= 20",
  },
  prolificDay: {
    name: "Prolific Day",
    description: "Made 50+ commits in a single day",
    icon: "⚡",
    criteria: "maxCommitsInDay >= 50",
  },
};

// =============================================================================
// WRAPPED FINAL SUMMARY CLOSERS — Rotating closing messages
// =============================================================================

export const finalSummaryClosers: string[] = [
  "Every commit tells a story. This was yours.",
  "Here's to another year of building, breaking, and fixing things.",
  "Your code is out there, running in the world. That's pretty incredible.",
  "From the first init to the latest push — this was your journey.",
  "The code you wrote this year will outlive this moment. Keep shipping.",
  "Behind every great product is a developer who kept committing. That's you.",
  "Another year, another thousand commits. The grind never stops.",
  "Your git history is a timeline of growth. Look how far you've come.",
  "Code is poetry. This year, you wrote an epic.",
  "Until next year's wrapped — keep pushing, keep building, keep creating.",
];

export function getRandomCloser(): string {
  return finalSummaryClosers[Math.floor(Math.random() * finalSummaryClosers.length)];
}

// =============================================================================
// SLIDE TRANSITION AUDIO CUE MAPPING (for SoundEffect enum usage)
// =============================================================================

export const slideAudioCues: Record<WrappedSlideType, string> = {
  [WrappedSlideType.INTRO]: 'whoosh',
  [WrappedSlideType.TOP_REPOS]: 'reveal',
  [WrappedSlideType.PRODUCTIVITY]: 'counter-tick',
  [WrappedSlideType.LANGUAGE_EVOLUTION]: 'slide-transition',
  [WrappedSlideType.STREAKS]: 'reveal',
  [WrappedSlideType.MONTHLY_BREAKDOWN]: 'slide-transition',
  [WrappedSlideType.YEARLY_COMPARISON]: 'counter-tick',
  [WrappedSlideType.SUPERLATIVES]: 'confetti',
  [WrappedSlideType.FINAL_SUMMARY]: 'success',
};

// =============================================================================
// TEMPLATE INTERPOLATION UTILITY
// =============================================================================

/**
 * Replaces {placeholder} tokens in a template string with values from a data object.
 *
 * @example
 * ```ts
 * interpolateTemplate("You made {totalCommits} commits", { totalCommits: 1234 })
 * // => "You made 1234 commits"
 * ```
 */
export function interpolateTemplate(
  template: string,
  data: Record<string, string | number | undefined | null>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = data[key];
    if (value === undefined || value === null) return match;
    return String(value);
  });
}

/**
 * Gets the share text for a specific slide, interpolated with real data.
 */
export function getShareText(
  slideType: WrappedSlideType,
  data: Record<string, string | number | undefined | null>
): string {
  const template = wrappedContentTemplates.shareTextTemplates[slideType];
  return interpolateTemplate(template, data);
}

/**
 * Gets a random fun fact, interpolated with real data.
 */
export function getRandomFunFact(
  data: Record<string, string | number | undefined | null>
): string {
  const templates = wrappedContentTemplates.funFacts;
  const template = templates[Math.floor(Math.random() * templates.length)];
  return interpolateTemplate(template, data);
}

/**
 * Gets the slide title for a specific slide type, interpolated with data.
 */
export function getSlideTitle(
  slideType: WrappedSlideType,
  data: Record<string, string | number | undefined | null>
): string {
  const template = wrappedContentTemplates.slideTitles[slideType];
  return interpolateTemplate(template, data);
}

/**
 * Gets the slide subtitle for a specific slide type, interpolated with data.
 */
export function getSlideSubtitle(
  slideType: WrappedSlideType,
  data: Record<string, string | number | undefined | null>
): string {
  const template = wrappedContentTemplates.slideSubtitles[slideType];
  return interpolateTemplate(template, data);
}

/**
 * Formats a number with commas for display in wrapped slides.
 */
export function formatWrappedNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Formats a number with K/M suffix for compact display.
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}

/**
 * Gets the appropriate ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
export function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Gets the month name from a month number (1-12).
 */
export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return months[month - 1] || 'Unknown';
}

/**
 * Gets the day name from a day-of-week number (0=Sunday).
 */
export function getDayName(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day] || 'Unknown';
}

/**
 * Determines the season from a month number.
 */
export function getSeason(month: number): string {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}
