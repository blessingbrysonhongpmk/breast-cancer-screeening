import React from 'react';

/**
 * High-fidelity Pink Ribbon SVG
 */
export const PinkRibbon: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }> = ({
  size = 64,
  className = '',
  style = {}
}) => (
  <svg
    width={size}
    height={size * 1.3}
    viewBox="0 0 100 130"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', flexShrink: 0, ...style }}
  >
    <defs>
      <linearGradient id="ribbonMainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF4D97" />
        <stop offset="50%" stopColor="#E61E72" />
        <stop offset="100%" stopColor="#BA1255" />
      </linearGradient>
      <linearGradient id="ribbonDarkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C4135D" />
        <stop offset="100%" stopColor="#8C093F" />
      </linearGradient>
      <filter id="ribbonShadow" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#C4135D" floodOpacity="0.25" />
      </filter>
    </defs>
    <g filter="url(#ribbonShadow)">
      {/* Back Loop */}
      <path
        d="M 32 58 C 15 40 22 10 50 10 C 78 10 85 40 68 58 Z"
        fill="url(#ribbonDarkGrad)"
      />
      {/* Inner Cutout */}
      <ellipse cx="50" cy="34" rx="14" ry="18" fill="#FFF0F5" opacity="0.95" />

      {/* Left Front Leg */}
      <path
        d="M 50 50 C 35 68 20 88 16 118 L 32 122 C 38 98 48 80 62 60 Z"
        fill="url(#ribbonMainGrad)"
      />

      {/* Right Front Leg (Crosses over) */}
      <path
        d="M 38 60 C 52 80 62 98 68 122 L 84 118 C 80 88 65 68 50 50 Z"
        fill="url(#ribbonMainGrad)"
      />

      {/* Front Loop Cap for 3D Overlap */}
      <path
        d="M 34 50 C 22 36 28 12 50 12 C 72 12 78 36 66 50 C 58 40 54 28 50 28 C 46 28 42 40 34 50 Z"
        fill="url(#ribbonMainGrad)"
      />
    </g>
  </svg>
);

/**
 * Sidebar Woman Profile Silhouette with Flowing Hair
 */
export const WomanSilhouette: React.FC<{ width?: number; height?: number }> = ({
  width = 160,
  height = 140
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 160 140"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'block', margin: '0 auto', opacity: 0.88 }}
  >
    <defs>
      <linearGradient id="womanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF70A6" />
        <stop offset="60%" stopColor="#E62E78" />
        <stop offset="100%" stopColor="#B31A56" />
      </linearGradient>
    </defs>
    {/* Flowing hair and head profile */}
    <path
      d="M 35 130 C 30 110 32 95 38 82 C 45 68 40 52 48 38 C 55 25 70 18 84 20 C 96 22 108 30 110 44 C 112 56 104 66 98 75 C 92 84 88 96 90 108 C 92 120 102 128 108 135 Z"
      fill="url(#womanGrad)"
      opacity="0.35"
    />
    <path
      d="M 48 135 C 44 118 48 102 55 90 C 62 76 60 62 68 48 C 74 38 86 32 96 36 C 105 40 108 52 102 62 C 96 72 90 84 92 98 C 94 112 100 125 102 135 Z"
      fill="url(#womanGrad)"
      opacity="0.5"
    />
    {/* Woman profile face outline */}
    <path
      d="M 94 42 C 98 42 104 46 106 50 C 108 53 105 56 102 57 C 104 60 106 63 103 66 C 100 68 97 68 95 72 C 93 76 94 82 96 88 C 98 94 99 105 92 120 C 85 135 78 140 78 140"
      stroke="#FF94BD"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Closed eyelash / serene eye */}
    <path
      d="M 96 52 C 98 54 100 54 102 53"
      stroke="#FF94BD"
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
    />
    {/* Subtle lips line */}
    <path
      d="M 101 64 C 99 64 97 65 96 66"
      stroke="#FF94BD"
      strokeWidth="1.6"
      strokeLinecap="round"
      fill="none"
    />
    {/* Miniature Pink Ribbon at bottom right of woman silhouette */}
    <g transform="translate(112, 92) scale(0.32)">
      <path
        d="M 32 58 C 15 40 22 10 50 10 C 78 10 85 40 68 58 Z"
        fill="#8C093F"
      />
      <ellipse cx="50" cy="34" rx="14" ry="18" fill="#3D0B24" />
      <path
        d="M 50 50 C 35 68 20 88 16 118 L 32 122 C 38 98 48 80 62 60 Z"
        fill="#FF4D97"
      />
      <path
        d="M 38 60 C 52 80 62 98 68 122 L 84 118 C 80 88 65 68 50 50 Z"
        fill="#FF2E84"
      />
    </g>
  </svg>
);

/**
 * Radiology Workstation & Mammogram Scan Illustration for Hero Banner
 */
export const RadiologyWorkstation: React.FC<{ style?: React.CSSProperties }> = ({ style = {} }) => (
  <svg
    viewBox="0 0 380 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: '100%', height: '100%', maxHeight: '200px', ...style }}
  >
    <defs>
      <linearGradient id="roomGlow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFF0F5" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#F6D1DE" stopOpacity="0.8" />
      </linearGradient>
      <linearGradient id="monitorBezel" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2A1B24" />
        <stop offset="100%" stopColor="#140810" />
      </linearGradient>
      <linearGradient id="screenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0B131E" />
        <stop offset="50%" stopColor="#060C14" />
        <stop offset="100%" stopColor="#020509" />
      </linearGradient>
      <linearGradient id="mammoGlow" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="#B3E0FF" stopOpacity="0.9" />
        <stop offset="40%" stopColor="#5EA8DE" stopOpacity="0.6" />
        <stop offset="80%" stopColor="#1C4B75" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#051525" stopOpacity="0" />
      </linearGradient>
      <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    {/* Background Soft Ambient Radiology Suite */}
    <rect x="0" y="0" width="380" height="200" rx="16" fill="url(#roomGlow)" />

    {/* Mammography Unit Gantry in Background */}
    <g opacity="0.45" transform="translate(45, 10)">
      {/* Vertical Column */}
      <rect x="50" y="10" width="28" height="170" rx="6" fill="#FFFFFF" stroke="#D1B8C4" strokeWidth="2" />
      {/* Rotating C-Arm Top Arc */}
      <path d="M 64 25 C 95 25 110 50 110 75 L 110 120" stroke="#FFFFFF" strokeWidth="16" strokeLinecap="round" />
      <path d="M 64 25 C 95 25 110 50 110 75 L 110 120" stroke="#C4A6B5" strokeWidth="2" fill="none" />
      {/* Compression Paddle Plate */}
      <rect x="85" y="80" width="35" height="6" rx="2" fill="#E8F4FC" stroke="#90CAF9" strokeWidth="1" />
      <rect x="85" y="105" width="40" height="12" rx="3" fill="#FFFFFF" stroke="#B0BEC5" strokeWidth="1.5" />
      {/* Status indicator lights */}
      <circle cx="64" cy="45" r="3" fill="#00E676" />
      <circle cx="64" cy="55" r="3" fill="#29B6F6" />
    </g>

    {/* Modern High-Resolution PACS Diagnostic Display Monitor */}
    <g transform="translate(160, 15)">
      {/* Stand Base */}
      <ellipse cx="105" cy="175" rx="38" ry="8" fill="#1A0D15" opacity="0.6" />
      <rect x="100" y="125" width="10" height="48" rx="2" fill="#2D1C27" />

      {/* Monitor Outer Chassis */}
      <rect x="15" y="8" width="180" height="126" rx="8" fill="url(#monitorBezel)" stroke="#3E2836" strokeWidth="2" />

      {/* Screen Area */}
      <rect x="22" y="14" width="166" height="114" rx="4" fill="url(#screenGrad)" />

      {/* Rendered Mammogram Radiograph Breast Contour */}
      <g transform="translate(40, 20)">
        {/* Deep breast tissue outline */}
        <path
          d="M 90 8 C 50 12 18 38 12 70 C 8 92 25 102 70 102 L 95 102 Z"
          fill="url(#mammoGlow)"
        />
        {/* Dense fibroglandular parenchymal texture */}
        <path
          d="M 85 24 C 62 26 38 46 32 68 C 28 85 44 94 75 94 Z"
          fill="#D6EEFC"
          opacity="0.55"
          filter="url(#softGlow)"
        />
        {/* Core focal density / circumscribed mass indicator */}
        <ellipse cx="58" cy="58" rx="14" ry="12" fill="#FFFFFF" opacity="0.85" filter="url(#softGlow)" />
        <ellipse cx="58" cy="58" rx="8" ry="7" fill="#FFFFFF" opacity="0.95" />

        {/* Delicate vascular / ductal micro-calcification highlights */}
        <path d="M 38 45 Q 46 52 54 48" stroke="#E1F5FE" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <path d="M 66 65 Q 74 72 82 66" stroke="#E1F5FE" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <circle cx="52" cy="54" r="1.5" fill="#FFFFFF" />
        <circle cx="62" cy="56" r="1.2" fill="#FFFFFF" />
        <circle cx="56" cy="62" r="1.4" fill="#FFFFFF" />
      </g>

      {/* PACS GUI overlays (grid lines, crosshair, metadata text) */}
      <text x="26" y="24" fill="#546E7A" fontSize="6" fontFamily="monospace" fontWeight="600">R-CC 24x30cm</text>
      <text x="26" y="32" fill="#546E7A" fontSize="6" fontFamily="monospace">W: 4096 L: 2048</text>
      <text x="160" y="24" fill="#00E676" fontSize="6" fontFamily="monospace" textAnchor="end">AI: RESNET-50</text>
      <text x="160" y="32" fill="#29B6F6" fontSize="6" fontFamily="monospace" textAnchor="end">MIAS COHORT</text>

      {/* Subtle CAD / XAI focal bounding box overlay */}
      <rect x="88" y="68" width="30" height="26" rx="2" stroke="#FF4081" strokeWidth="1.2" strokeDasharray="3 2" fill="none" />
      <text x="90" y="65" fill="#FF4081" fontSize="5" fontFamily="sans-serif" fontWeight="700">FOCAL ROI</text>
    </g>
  </svg>
);

/**
 * Pink Ribbon with Floral Leaves for "Why It Matters?" Card
 */
export const RibbonWithLeaves: React.FC<{ size?: number }> = ({ size = 110 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 110 110"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', flexShrink: 0 }}
  >
    <defs>
      <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFA6C9" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#F06292" stopOpacity="0.4" />
      </linearGradient>
    </defs>
    {/* Soft pink botanical leaves */}
    <path
      d="M 68 85 C 80 82 92 90 94 100 C 82 102 72 94 68 85 Z"
      fill="url(#leafGrad)"
    />
    <path
      d="M 85 68 C 96 66 104 74 105 84 C 94 86 86 78 85 68 Z"
      fill="url(#leafGrad)"
    />
    <path
      d="M 52 90 C 60 98 62 106 58 110 C 50 106 48 98 52 90 Z"
      fill="url(#leafGrad)"
      opacity="0.6"
    />

    {/* Pink Ribbon in foreground */}
    <g transform="translate(18, 5) scale(0.75)">
      {/* Back Loop */}
      <path
        d="M 32 58 C 15 40 22 10 50 10 C 78 10 85 40 68 58 Z"
        fill="#8C093F"
      />
      <ellipse cx="50" cy="34" rx="14" ry="18" fill="#FFF0F5" />
      {/* Left Leg */}
      <path
        d="M 50 50 C 35 68 20 88 16 118 L 32 122 C 38 98 48 80 62 60 Z"
        fill="#FF4081"
      />
      {/* Right Leg */}
      <path
        d="M 38 60 C 52 80 62 98 68 122 L 84 118 C 80 88 65 68 50 50 Z"
        fill="#E91E63"
      />
      {/* Front Loop */}
      <path
        d="M 34 50 C 22 36 28 12 50 12 C 72 12 78 36 66 50 C 58 40 54 28 50 28 C 46 28 42 40 34 50 Z"
        fill="#FF6090"
      />
    </g>
  </svg>
);
