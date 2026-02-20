// =============================================================================
// GLSL SHADER SOURCES FOR WEBGL2 INSTANCED RENDERING
// =============================================================================

/** Full-screen quad vertex shader (for background + post-processing). */
export const FULLSCREEN_QUAD_VS = `#version 300 es
precision highp float;
const vec2 pos[4] = vec2[4](
  vec2(-1, -1), vec2(1, -1), vec2(-1, 1), vec2(1, 1)
);
const vec2 uv[4] = vec2[4](
  vec2(0, 0), vec2(1, 0), vec2(0, 1), vec2(1, 1)
);
out vec2 vUV;
void main() {
  vUV = uv[gl_VertexID];
  gl_Position = vec4(pos[gl_VertexID], 0.0, 1.0);
}
`;

/** Background fragment shader: dark gradient + vignette. */
export const BACKGROUND_FS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform vec3 uBgColor;
uniform vec2 uResolution;

void main() {
  // Subtle vignette
  vec2 center = vUV - 0.5;
  float dist = length(center);
  float vignette = 1.0 - smoothstep(0.2, 0.8, dist) * 0.3;
  fragColor = vec4(uBgColor * vignette, 1.0);
}
`;

// =============================================================================
// INSTANCED NODE RENDERING
// =============================================================================

/**
 * Node vertex shader: instanced quads.
 * Per-vertex: quad corner offset (2 floats).
 * Per-instance: position(2) + scale(1) + opacity(1) + color(3) + nodeType(1) + glowIntensity(1) + ringCount(1)
 * = 10 floats per instance
 */
export const NODE_VS = `#version 300 es
precision highp float;

// Per-vertex (unit quad corners)
layout(location = 0) in vec2 aCorner; // [-1,-1] to [1,1]

// Per-instance
layout(location = 1) in vec2 aPosition;
layout(location = 2) in float aScale;
layout(location = 3) in float aOpacity;
layout(location = 4) in vec3 aColor;
layout(location = 5) in float aNodeType; // 0=file, 1=directory
layout(location = 6) in float aGlowIntensity;
layout(location = 7) in float aRingCount;

uniform mat3 uViewMatrix; // camera transform: translate + scale
uniform float uNodeSize;

out vec2 vLocalPos; // [-1,1] quad position
out float vOpacity;
out vec3 vColor;
out float vNodeType;
out float vGlowIntensity;
out float vRingCount;
out float vScale;

void main() {
  float baseSize = uNodeSize;
  float isDir = step(0.5, aNodeType);

  // Directories: slightly larger base, files: scaled by modification
  float size = mix(baseSize * 1.1 * aScale, baseSize * 1.2, isDir);

  // Glow makes quad bigger to contain the glow halo
  float glowPadding = mix(1.0, 3.5, aGlowIntensity);
  float quadSize = size * glowPadding;

  vec2 worldPos = aPosition + aCorner * quadSize;
  vec3 clipPos = uViewMatrix * vec3(worldPos, 1.0);

  gl_Position = vec4(clipPos.xy, 0.0, 1.0);

  vLocalPos = aCorner * glowPadding;
  vOpacity = aOpacity;
  vColor = aColor;
  vNodeType = aNodeType;
  vGlowIntensity = aGlowIntensity;
  vRingCount = aRingCount;
  vScale = aScale;
}
`;

/** Node fragment shader: circle SDF with glow + highlight + pulse rings. */
export const NODE_FS = `#version 300 es
precision highp float;

in vec2 vLocalPos;
in float vOpacity;
in vec3 vColor;
in float vNodeType;
in float vGlowIntensity;
in float vRingCount;
in float vScale;
out vec4 fragColor;

void main() {
  float dist = length(vLocalPos);
  float isDir = step(0.5, vNodeType);

  // Discard fragments way outside
  if (dist > 3.5) discard;

  float alpha = 0.0;
  vec3 color = vColor;

  // --- Glow halo (soft radial falloff) ---
  if (vGlowIntensity > 0.01) {
    float glowDist = dist / 3.0;
    float glow = exp(-glowDist * glowDist * 3.0) * vGlowIntensity;
    alpha += glow * 0.5;
  }

  // --- Ambient glow for all nodes ---
  float ambientDist = dist / 2.0;
  float ambient = exp(-ambientDist * ambientDist * 2.0) * mix(0.08, 0.05, isDir);
  alpha += ambient;

  // --- Directory: ring + center dot ---
  if (isDir > 0.5) {
    // Ring at dist ~= 1.0
    float ring = smoothstep(0.9, 1.0, dist) - smoothstep(1.0, 1.15, dist);
    alpha += ring * 0.5;

    // Center dot
    float dot = 1.0 - smoothstep(0.0, 0.6, dist);
    alpha += dot * 0.6;
  }
  // --- File: filled circle with highlight ---
  else {
    // Main circle edge (SDF anti-aliased)
    float circle = 1.0 - smoothstep(0.5, 0.55, dist);
    alpha += circle * mix(0.85, 1.0, vGlowIntensity);

    // Inner specular highlight
    vec2 hlOffset = vLocalPos - vec2(-0.1, -0.12);
    float hlDist = length(hlOffset);
    float highlight = (1.0 - smoothstep(0.0, 0.22, hlDist)) * 0.2;
    color = mix(color, vec3(1.0), highlight);

    // Pulse rings (expanding outward when scale > 1)
    if (vRingCount >= 1.0) {
      float ring1 = smoothstep(0.7, 0.8, dist) - smoothstep(0.8, 0.95, dist);
      alpha += ring1 * min(0.8, (vScale - 1.0) * 0.7);
    }
    if (vRingCount >= 2.0) {
      float ring2 = smoothstep(1.2, 1.3, dist) - smoothstep(1.3, 1.5, dist);
      alpha += ring2 * min(0.3, (vScale - 1.0) * 0.3);
    }
    if (vRingCount >= 3.0) {
      float ring3 = smoothstep(1.8, 1.9, dist) - smoothstep(1.9, 2.2, dist);
      alpha += ring3 * min(0.15, (vScale - 1.0) * 0.15);
    }
  }

  alpha *= vOpacity;
  if (alpha < 0.005) discard;

  fragColor = vec4(color * alpha, alpha);
}
`;

// =============================================================================
// INSTANCED EDGE RENDERING
// =============================================================================

/** Edge vertex shader: interpolates between from/to endpoints per instance. */
export const EDGE_VS = `#version 300 es
precision highp float;

// Per-vertex (line segment endpoint: 0 or 1)
layout(location = 0) in float aT;

// Per-instance
layout(location = 1) in vec2 aFrom;
layout(location = 2) in vec2 aTo;
layout(location = 3) in float aOpacity;
layout(location = 4) in vec3 aColor;
layout(location = 5) in float aThickness;

uniform mat3 uViewMatrix;

out float vOpacity;
out vec3 vColor;

void main() {
  vec2 pos = mix(aFrom, aTo, aT);
  vec3 clipPos = uViewMatrix * vec3(pos, 1.0);
  gl_Position = vec4(clipPos.xy, 0.0, 1.0);
  vOpacity = aOpacity;
  vColor = aColor;
}
`;

/** Edge fragment shader: flat color with per-instance opacity. */
export const EDGE_FS = `#version 300 es
precision highp float;

in float vOpacity;
in vec3 vColor;
out vec4 fragColor;

void main() {
  fragColor = vec4(vColor * vOpacity, vOpacity);
}
`;

// =============================================================================
// INSTANCED BEAM RENDERING
// =============================================================================

/** Beam vertex shader: animates a line from origin to head via progress uniform. */
export const BEAM_VS = `#version 300 es
precision highp float;

layout(location = 0) in float aT; // 0..1 along beam

// Per-instance
layout(location = 1) in vec2 aFrom;
layout(location = 2) in vec2 aTo;
layout(location = 3) in float aProgress;
layout(location = 4) in float aOpacity;
layout(location = 5) in vec3 aColor;

uniform mat3 uViewMatrix;

out float vT;
out float vProgress;
out float vOpacity;
out vec3 vColor;

void main() {
  // Only draw up to current progress
  float drawT = aT * aProgress;
  vec2 pos = mix(aFrom, aTo, drawT);
  vec3 clipPos = uViewMatrix * vec3(pos, 1.0);
  gl_Position = vec4(clipPos.xy, 0.0, 1.0);

  vT = aT;
  vProgress = aProgress;
  vOpacity = aOpacity;
  vColor = aColor;
}
`;

/** Beam fragment shader: fading trail with a bright head. */
export const BEAM_FS = `#version 300 es
precision highp float;

in float vT;
in float vProgress;
in float vOpacity;
in vec3 vColor;
out vec4 fragColor;

void main() {
  // Fade trail: stronger at the head
  float trailFade = smoothstep(max(0.0, vProgress - 0.3), vProgress, vT * vProgress);
  float alpha = trailFade * vOpacity;
  if (alpha < 0.01) discard;
  fragColor = vec4(vColor * alpha, alpha);
}
`;

// =============================================================================
// INSTANCED PARTICLE RENDERING (point sprites)
// =============================================================================

/** Particle vertex shader: point sprites with per-instance size and color. */
export const PARTICLE_VS = `#version 300 es
precision highp float;

// Per-instance
layout(location = 0) in vec2 aPosition;
layout(location = 1) in float aSize;
layout(location = 2) in float aOpacity;
layout(location = 3) in vec3 aColor;

uniform mat3 uViewMatrix;
uniform float uPixelRatio;

out float vOpacity;
out vec3 vColor;

void main() {
  vec3 clipPos = uViewMatrix * vec3(aPosition, 1.0);
  gl_Position = vec4(clipPos.xy, 0.0, 1.0);
  gl_PointSize = aSize * uPixelRatio * 3.0;
  vOpacity = aOpacity;
  vColor = aColor;
}
`;

/** Particle fragment shader: soft circle with additive glow. */
export const PARTICLE_FS = `#version 300 es
precision highp float;

in float vOpacity;
in vec3 vColor;
out vec4 fragColor;

void main() {
  vec2 pc = gl_PointCoord * 2.0 - 1.0;
  float dist = length(pc);
  if (dist > 1.0) discard;

  // Soft circle with glow
  float alpha = (1.0 - dist * dist) * vOpacity * 0.8;
  fragColor = vec4(vColor * alpha, alpha);
}
`;

// =============================================================================
// BLOOM POST-PROCESS
// =============================================================================

/** Threshold pass: extract bright pixels for bloom. */
export const BLOOM_THRESHOLD_FS = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uScene;
uniform float uThreshold;

void main() {
  vec4 color = texture(uScene, vUV);
  float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  if (brightness > uThreshold) {
    fragColor = color;
  } else {
    fragColor = vec4(0.0);
  }
}
`;

/** Gaussian blur (horizontal or vertical depending on uDirection). */
export const BLUR_FS = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uTexture;
uniform vec2 uDirection; // (1/width, 0) or (0, 1/height)

const float weights[5] = float[5](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);

void main() {
  vec4 result = texture(uTexture, vUV) * weights[0];
  for (int i = 1; i < 5; i++) {
    vec2 offset = uDirection * float(i);
    result += texture(uTexture, vUV + offset) * weights[i];
    result += texture(uTexture, vUV - offset) * weights[i];
  }
  fragColor = result;
}
`;

/** Additive composite: blend bloom texture onto scene. */
export const COMPOSITE_FS = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;

void main() {
  vec4 scene = texture(uScene, vUV);
  vec4 bloom = texture(uBloom, vUV);
  fragColor = scene + bloom * uBloomStrength;
}
`;

// =============================================================================
// CONTRIBUTOR RENDERING (instanced quads with texture)
// =============================================================================

/** Contributor vertex shader: instanced quads for avatar circles. */
export const CONTRIBUTOR_VS = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aCorner;

// Per-instance
layout(location = 1) in vec2 aPosition;
layout(location = 2) in float aOpacity;
layout(location = 3) in vec3 aColor;
layout(location = 4) in float aSize;

uniform mat3 uViewMatrix;

out vec2 vLocalPos;
out float vOpacity;
out vec3 vColor;

void main() {
  float quadSize = aSize;
  vec2 worldPos = aPosition + aCorner * quadSize;
  vec3 clipPos = uViewMatrix * vec3(worldPos, 1.0);
  gl_Position = vec4(clipPos.xy, 0.0, 1.0);

  vLocalPos = aCorner;
  vOpacity = aOpacity;
  vColor = aColor;
}
`;

/** Contributor fragment shader: circle fill with border ring and glow. */
export const CONTRIBUTOR_FS = `#version 300 es
precision highp float;

in vec2 vLocalPos;
in float vOpacity;
in vec3 vColor;
out vec4 fragColor;

void main() {
  float dist = length(vLocalPos);
  if (dist > 1.0) discard;

  // Glow halo
  float glow = exp(-dist * dist * 2.0) * 0.15;

  // Circle fill
  float circle = 1.0 - smoothstep(0.85, 0.95, dist);

  // Border ring
  float ring = smoothstep(0.8, 0.85, dist) - smoothstep(0.95, 1.0, dist);

  float alpha = (circle * 0.9 + ring * 0.9 + glow) * vOpacity;
  vec3 color = mix(vColor, vec3(1.0), ring * 0.3);

  fragColor = vec4(color * alpha, alpha);
}
`;
