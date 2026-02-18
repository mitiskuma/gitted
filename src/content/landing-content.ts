// src/content/landing-content.ts

import type { LandingContent, FeatureItem, HowItWorksStep, SocialProofStat } from '@/lib/types';

/**
 * Static content for the Gitted landing page.
 * All copy is derived from the project's core functionality:
 * Git history analysis, Spotify Wrapped-style visualizations,
 * AI-powered story generation, and Gource-style repository visualizations.
 */

// =============================================================================
// HERO SECTION
// =============================================================================

export const heroContent = {
  headline: 'Your Code Has a Story. It\'s Time to Tell It.',
  subheadline:
    'Connect your GitHub, select your repositories, and let Gitted transform thousands of commits into beautiful visualizations, AI-powered narratives, and a Spotify Wrapped-style recap of your developer journey.',
  ctaText: 'Connect GitHub & Start',
  ctaLink: '/connect',
  secondaryCta: {
    text: 'See How It Works',
    link: '#how-it-works',
  },
  badge: 'Powered by Claude AI & GitHub API',
  backgroundGradient: ['#1a1a2e', '#16213e', '#0f3460'] as [string, string, string],
} as const;

// =============================================================================
// FEATURES
// =============================================================================

export const features: FeatureItem[] = [
  {
    icon: '📖',
    title: 'AI-Powered Story Generation',
    description:
      'Claude intelligently processes thousands of commits — batching, summarizing, and weaving them into a compelling narrative of your developer journey. Each repository gets its own chapter, and all repos are unified into one epic backstory.',
    link: '/story',
    gradientColors: ['#3178c6', '#663399'],
  },
  {
    icon: '🎁',
    title: 'Developer Wrapped',
    description:
      'Just like Spotify Wrapped, but for your code. Discover your most productive months, longest streaks, peak coding hours, favorite commit words, and whether you\'re a night owl or early bird — presented in stunning animated slides you can share.',
    link: '/wrapped',
    gradientColors: ['#e94560', '#533483'],
  },
  {
    icon: '🌳',
    title: 'Gource Visualization',
    description:
      'Watch your repositories come alive with a real-time force-directed visualization. See files bloom as tree nodes, contributors move between them, and commit beams pulse through your codebase — for individual repos or all of them combined.',
    link: '/gource',
    gradientColors: ['#0f3460', '#16213e'],
  },
  {
    icon: '📊',
    title: 'Deep Analytics Dashboard',
    description:
      'Contribution heatmaps, commit frequency timelines, language breakdowns, coding pattern matrices, year-over-year growth, monthly breakdowns, and productivity metrics — all computed client-side from your real commit data.',
    link: '/dashboard',
    gradientColors: ['#240046', '#3c096c'],
  },
  {
    icon: '🏆',
    title: 'Superlatives & Badges',
    description:
      'Earn badges and discover fun superlatives: your longest commit message, busiest single hour, most churned repository, fix-to-feature ratio, and more. A playful lens on the patterns hidden in your git history.',
    link: '/wrapped',
    gradientColors: ['#5a189a', '#7b2ff7'],
  },
  {
    icon: '🔗',
    title: 'Multi-Repository Intelligence',
    description:
      'Select any combination of your repositories — public or private. Gitted smartly handles repos with 10 commits or 10,000, batching and summarizing at scale so you get insights across your entire portfolio, not just one project.',
    link: '/connect',
    gradientColors: ['#801336', '#2d132c'],
  },
];

// =============================================================================
// HOW IT WORKS
// =============================================================================

export const howItWorksSteps: HowItWorksStep[] = [
  {
    step: 1,
    icon: '🔑',
    title: 'Connect Your Accounts',
    description:
      'Provide your Claude API token for AI story generation, then connect your GitHub account via OAuth. Your tokens are encrypted and never stored on our servers.',
  },
  {
    step: 2,
    icon: '📂',
    title: 'Select Your Repositories',
    description:
      'Browse all your GitHub repositories — filter by language, visibility, or search by name. Select the ones you want to analyze. Pick 1 or pick 50 — we handle the scale.',
  },
  {
    step: 3,
    icon: '⚙️',
    title: 'Smart Processing',
    description:
      'Gitted fetches commits, batches them intelligently (100 per batch for Claude, 500 per chunk for analytics), caches everything in IndexedDB, and computes your analytics. Repos with 5,000+ commits are processed server-side for performance.',
  },
  {
    step: 4,
    icon: '✨',
    title: 'Explore Your Results',
    description:
      'Dive into your Dashboard for analytics, read your AI-generated Story, experience your Developer Wrapped slideshow, or watch the Gource visualization bring your code to life. Share any of it with the world.',
  },
];

// =============================================================================
// CTA SECTION
// =============================================================================

export const ctaContent = {
  headline: 'Every Commit Tells a Story',
  subheadline:
    'You\'ve written the code. Now see the bigger picture — your growth, your patterns, your journey as a developer, visualized and narrated like never before.',
  buttonText: 'Get Started — It\'s Free',
  buttonLink: '/connect',
  secondaryText: 'No sign-up required. Just connect GitHub and go.',
} as const;

// =============================================================================
// SOCIAL PROOF / STATS PLACEHOLDERS
// =============================================================================

export const socialProofStats: SocialProofStat[] = [
  {
    label: 'Commits Analyzed',
    value: '2M+',
    animate: true,
  },
  {
    label: 'Repositories Visualized',
    value: '15K+',
    animate: true,
  },
  {
    label: 'Stories Generated',
    value: '8K+',
    animate: true,
  },
  {
    label: 'Developer Wraps Created',
    value: '12K+',
    animate: true,
  },
];

// =============================================================================
// TECH STACK HIGHLIGHTS (for credibility section)
// =============================================================================

export const techStackHighlights = [
  {
    name: 'Next.js 15',
    description: 'App Router with server and client components',
    color: '#000000',
  },
  {
    name: 'TypeScript',
    description: 'End-to-end type safety across the entire codebase',
    color: '#3178c6',
  },
  {
    name: 'Claude AI',
    description: 'Intelligent commit summarization and story generation',
    color: '#663399',
  },
  {
    name: 'GitHub API',
    description: 'OAuth integration with full repository and commit access',
    color: '#1e2327',
  },
  {
    name: 'Canvas 2D',
    description: 'Force-directed Gource visualization at 60fps',
    color: '#f1e05a',
  },
  {
    name: 'IndexedDB',
    description: 'Client-side caching with TTL for commits, analytics, and stories',
    color: '#34d399',
  },
] as const;

// =============================================================================
// FOOTER CONTENT
// =============================================================================

export const footerContent = {
  brand: {
    name: 'Gitted',
    tagline: 'Your code, your story, beautifully told.',
    description:
      'Gitted transforms your GitHub history into stunning visualizations, AI-powered narratives, and developer analytics. Inspired by git-wrapped.com and the Gource visualization tool.',
  },
  links: {
    product: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Story', href: '/story' },
      { label: 'Wrapped', href: '/wrapped' },
      { label: 'Gource', href: '/gource' },
    ],
    resources: [
      { label: 'How It Works', href: '/#how-it-works' },
      { label: 'GitHub', href: 'https://github.com' },
      { label: 'Claude API', href: 'https://docs.anthropic.com' },
    ],
    legal: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'MIT License', href: '/license' },
    ],
  },
  copyright: `© ${new Date().getFullYear()} Gitted. Open source under MIT License.`,
  madeWith: 'Built with Next.js, TypeScript, Claude AI, and a love for git history.',
} as const;

// =============================================================================
// TESTIMONIAL PLACEHOLDERS
// =============================================================================

export const testimonialPlaceholders = [
  {
    quote:
      'I had no idea my commit patterns told such a fascinating story. Gitted turned 3 years of code into something I\'m proud to share.',
    author: 'Developer',
    role: 'Open Source Contributor',
    avatar: null,
  },
  {
    quote:
      'The Wrapped experience is addictive. Finding out I\'m a night owl who peaks on Tuesdays was both hilarious and accurate.',
    author: 'Developer',
    role: 'Full Stack Engineer',
    avatar: null,
  },
  {
    quote:
      'Watching the Gource visualization of our entire team\'s work over 2 years gave us chills. This is how you celebrate shipping.',
    author: 'Developer',
    role: 'Engineering Lead',
    avatar: null,
  },
] as const;

// =============================================================================
// FAQ CONTENT
// =============================================================================

export const faqItems = [
  {
    question: 'How does Gitted handle repositories with thousands of commits?',
    answer:
      'Gitted uses a smart batching strategy. For repos under 500 commits, everything is processed directly. For 500–5,000 commits, data is chunked into batches of 500 with merged results. For 5,000+ commits, server-side processing kicks in. For Claude story generation, commits are batched into groups of ~100 and summarized before narrative generation to stay within token limits.',
  },
  {
    question: 'Is my code or data stored on your servers?',
    answer:
      'No. All git data is fetched directly from the GitHub API to your browser and cached locally in IndexedDB. Your Claude token and GitHub token are encrypted client-side. Story generation calls go through our API route as a proxy, but no commit data or stories are persisted server-side.',
  },
  {
    question: 'Do I need both a Claude API token and GitHub account?',
    answer:
      'You need GitHub OAuth to access your repositories and commit history. The Claude API token is required only for the AI-powered Story feature. The Dashboard, Wrapped, and Gource visualizations work with just GitHub connected.',
  },
  {
    question: 'Can I analyze private repositories?',
    answer:
      'Yes. When you authenticate via GitHub OAuth, you can grant access to private repositories. Gitted respects your GitHub permissions — you\'ll only see repos you have access to.',
  },
  {
    question: 'What is the Gource visualization?',
    answer:
      'Gource is a software visualization tool that shows a repository\'s file tree evolving over time, with contributors appearing as avatars making changes. Gitted recreates this experience in your browser using Canvas 2D with force-directed layout, commit beams, particle effects, and smooth playback controls.',
  },
  {
    question: 'Can I share my Wrapped or Story?',
    answer:
      'Absolutely. Each Wrapped slide and Story page has share functionality built in. We capture the DOM as a high-quality PNG image, which you can download or share via the Web Share API (Twitter, LinkedIn, etc.) with a fallback to clipboard copy.',
  },
] as const;

// =============================================================================
// ANIMATION / VISUAL CONSTANTS
// =============================================================================

export const landingAnimations = {
  heroParticleCount: 50,
  heroParticleColors: ['#3178c6', '#663399', '#f1e05a', '#e94560', '#7b2ff7'],
  featureCardHoverScale: 1.02,
  statsCounterDuration: 2000,
  sectionRevealThreshold: 0.15,
  gradientAnimationDuration: '8s',
} as const;

// =============================================================================
// COMBINED LANDING CONTENT EXPORT
// =============================================================================

export const landingContent: LandingContent = {
  hero: {
    headline: heroContent.headline,
    subheadline: heroContent.subheadline,
    ctaText: heroContent.ctaText,
    ctaLink: heroContent.ctaLink,
  },
  features,
  howItWorks: howItWorksSteps,
  cta: {
    headline: ctaContent.headline,
    subheadline: ctaContent.subheadline,
    buttonText: ctaContent.buttonText,
    buttonLink: ctaContent.buttonLink,
  },
  socialProof: socialProofStats,
};

export default landingContent;
