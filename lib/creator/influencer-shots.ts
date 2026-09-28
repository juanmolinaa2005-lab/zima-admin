export const FACE_SHOT_ID = "face-front";
/** 4:5 portrait pixels for the canonical face still. */
export const FACE_IMAGE_SIZE = { width: 1024, height: 1280 } as const;

export const INFLUENCER_SHOTS = [
  {
    id: FACE_SHOT_ID,
    label: "Rostro",
    imageSize: "4:5" as const,
    framing:
      "tight close-up portrait, face filling the frame, looking at camera, 85mm lens, sharp eyes, natural skin texture, studio-soft daylight",
  },
  {
    id: "face-three-quarter",
    label: "3/4 rostro",
    imageSize: "square_hd" as const,
    framing:
      "three-quarter close-up of the same person. The head is physically turned about 30-40 degrees, not a frontal face rotated in 2D. Near ear and near cheek dominate; the far eye is smaller; the nose shows a side plane; the jaw silhouette changes. Shoulders visible. New photograph, different camera position.",
  },
  {
    id: "waist-up",
    label: "Medio cuerpo",
    imageSize: "portrait_4_3" as const,
    framing:
      "waist-up medium shot from farther away. The face is only a small part of the frame (about 15-25%), not a pasted close-up. Relaxed influencer pose, hands visible, looking toward camera, indoor natural light. Facial features are smaller and less detailed because of distance.",
  },
  {
    id: "full-front",
    label: "Cuerpo completo",
    imageSize: "portrait_16_9" as const,
    framing:
      "full-body standing shot from several meters away, head to shoes visible, facing camera. The face is small in the frame like a real full-body photo, not a portrait head on a tiny body. Confident casual stance, uncropped.",
  },
  {
    id: "full-three-quarter",
    label: "3/4 cuerpo",
    imageSize: "portrait_16_9" as const,
    framing:
      "full-body three-quarter standing pose, body turned 30-45 degrees, entire body from head to feet. Face seen from three-quarter at a distance: one ear, receding far cheek, changed nose silhouette. Same outfit, new camera.",
  },
  {
    id: "over-shoulder",
    label: "Espalda / hombro",
    imageSize: "portrait_16_9" as const,
    framing:
      "over-the-shoulder / back three-quarter view. Back of the head, nape, and shoulders dominate. They glance back so only part of the face is visible (one eye, cheek, jaw). Do not show a full frontal face. Full body still readable, same outfit.",
  },
] as const;

export type InfluencerShotId = (typeof INFLUENCER_SHOTS)[number]["id"];

const IDENTITY = `
Photorealistic photograph of a real person, shot like a candid iPhone photo, not illustration, not CGI, not beauty-filtered, not plastic skin.
Natural skin pores, flyaway hairs, realistic eyes and teeth, real cloth texture, natural indoor light.
Keep identity locked: exact same face, age, ethnicity, hair, skin tone, eye color, body type, and clothing style in every shot.
No text, logos, watermarks, captions, or extra people.
`.replace(/\s+/g, " ").trim();

const FACE_RECIPE = {
  subject: {
    person_description: "",
    identity_description: "",
    facial_features_description: "",
    hair_description: "",
    skin_tone_description: "",
    eye_description: "",
    age_description: "",
    ethnicity_description: "",
    gender_description: "",
  },
  image_type: {
    medium: "photograph",
    style: "natural realistic photography",
    genre: "close-up facial portrait",
    visual_goal:
      "believable real-world photograph rather than an artificially perfect or hyperreal render",
    render_appearance: "camera-captured image",
    cgi_appearance: false,
    illustration_appearance: false,
  },
  composition: {
    shot_type: "extreme close-up to tight facial close-up",
    framing: "face only",
    visible_area: [
      "entire face",
      "forehead",
      "eyes",
      "nose",
      "mouth",
      "chin",
      "small portions of the sides of the head if naturally required",
    ],
    exclude_from_frame: [
      "chest",
      "torso",
      "shoulders whenever possible",
      "hands",
      "arms",
      "full body",
      "environmental objects",
    ],
    face_occupancy: "approximately 75-90% of the image",
    orientation: "portrait",
    camera_height: "approximately eye level",
    camera_angle: "mostly frontal",
    perspective: "natural human portrait perspective",
    headroom: "minimal but natural",
    cropping: "tight but without unintentionally cutting important facial features",
    centering: "slightly imperfect natural centering allowed",
    symmetry: "avoid mathematically perfect symmetry",
  },
  camera: {
    camera_type: "modern consumer or prosumer digital camera",
    capture_feel: "real photographic capture",
    lens_equivalent: "approximately 70-105mm full-frame equivalent",
    preferred_focal_length: "85mm equivalent",
    perspective_distortion: "very low",
    wide_angle_distortion: false,
    fisheye_distortion: false,
    camera_distance: "appropriate portrait distance for realistic facial proportions",
    aperture: "approximately f/2.8-f/5.6",
    shutter_speed: "fast enough to avoid obvious motion blur",
    iso: "low to moderate",
    white_balance: "neutral to very slightly cool",
    exposure: "natural and slightly imperfect",
    dynamic_range: "realistic, not exaggerated HDR",
  },
  focus: {
    focus_target: "eyes and central facial plane",
    eye_focus: "sharp but not artificially oversharpened",
    focus_accuracy: "high",
    depth_of_field: "moderately shallow",
    facial_plane: "most important facial features remain readable",
    background_focus: "soft",
    edge_sharpness: "naturally reduced away from focal plane",
    microcontrast: "moderate",
  },
  lighting: {
    style: "soft naturalistic lighting",
    source_feel: "window light or large diffuse ambient source",
    direction: "mostly frontal with slight lateral bias",
    contrast: "low to moderate",
    shadow_transition: "soft",
    highlight_behavior: "gentle and realistic",
    skin_highlights: "subtle natural highlights only",
    forehead_highlight: "controlled",
    nose_highlight: "controlled",
    cheek_highlight: "subtle",
    eye_catchlights: "small and believable",
    rim_light: false,
    beauty_light: false,
    ring_light: false,
    hard_flash: false,
    dramatic_cinematic_light: false,
    studio_perfection: false,
    lighting_uniformity: "slightly imperfect and physically plausible",
  },
  color: {
    temperature: "neutral to slightly cool",
    warmth: "low",
    saturation: "natural and restrained",
    contrast: "moderate-low",
    black_point: "natural",
    white_point: "natural",
    skin_color_processing: "minimal",
    color_grading: "very subtle",
    cinematic_teal_orange: false,
    orange_cast: false,
    yellow_cast: false,
    magenta_cast: false,
    hdr_color: false,
  },
  skin_rendering: {
    priority: "natural photographic skin texture",
    texture_visibility: "visible but subtle",
    pores: "small, irregular and naturally distributed",
    microtexture: "present",
    fine_lines: "allowed where naturally visible",
    tiny_bumps: "allowed",
    minor_redness: "allowed",
    minor_color_variation: "allowed",
    small_marks: "allowed",
    "small blemishes": "allowed",
    under_eye_texture: "natural",
    natural_oil: "subtle",
    skin_reflectivity: "physically plausible",
    skin_smoothing: "minimal",
    beauty_retouching: "none or extremely subtle",
    airbrushing: false,
    plastic_skin: false,
    wax_skin: false,
    porcelain_skin: false,
    perfect_skin: false,
    exaggerated_pores: false,
    fake_skin_detail: false,
    procedural_skin_pattern: false,
  },
  realism: {
    realism_level: "high",
    realism_method: "natural imperfection rather than exaggerated detail",
    goal: "indistinguishable from a normal high-quality portrait photograph",
    physical_plausibility: "high",
    facial_geometry: "natural",
    surface_detail: "restrained",
    imperfection_level: "subtle",
    camera_imperfections: "slightly present",
    digital_cleanliness: "not perfectly sterile",
    avoid_hyperrealism: true,
    avoid_uncanny_realism: true,
    avoid_ai_perfection: true,
    avoid_beauty_editorial_finish: true,
  },
  image_quality: {
    overall_quality: "high photographic quality",
    resolution: "high resolution",
    detail_level: "high but restrained",
    sharpness: "natural",
    oversharpening: false,
    clarity: "moderate",
    texture_clarity: "natural",
    compression: "light realistic compression allowed",
    noise: "very subtle natural sensor noise allowed",
    grain: "extremely subtle",
    artifacting: "minimal",
    banding: "none",
    posterization: "none",
    haloing: "none",
    edge_enhancement: "minimal",
    hdr_effect: "none",
  },
  photographic_imperfections: {
    allow: true,
    subtle_sensor_noise: true,
    very_mild_lens_softness: true,
    tiny_focus_falloff: true,
    minor_exposure_variation: true,
    slight_asymmetry: true,
    tiny_hair_flyaways: true,
    natural_texture_variation: true,
    perfect_digital_cleanliness: false,
  },
  background: {
    type: "plain neutral background",
    importance: "minimal",
    detail: "none",
    objects: "none",
    text: "none",
    patterns: "none",
    visual_distractions: "none",
    color: "neutral gray, cool gray, off-white or another unobtrusive neutral",
    depth: "softly blurred if visible",
    studio_backdrop_feel: "subtle rather than obvious",
  },
  post_processing: {
    amount: "minimal",
    retouching: "minimal",
    skin_smoothing: "minimal",
    frequency_separation_look: false,
    beauty_filter: false,
    face_filter: false,
    sharpening: "light",
    noise_reduction: "light",
    contrast_adjustment: "subtle",
    saturation_adjustment: "subtle",
    clarity_adjustment: "subtle",
    local_dodge_and_burn: "minimal",
    vignette: "none or nearly imperceptible",
    cinematic_grade: false,
  },
  natural_camera_look: {
    priority: "high",
    description:
      "The photograph should look as though a real camera captured a real face under ordinary controlled lighting, without excessive computational perfection.",
    slight_softness: true,
    natural_acutance: true,
    subtle_sensor_character: true,
    real_lens_behavior: true,
    perfect_pixel_uniformity: false,
  },
  output: {
    aspect_ratio: "4:5",
    orientation: "vertical",
    face_only: true,
    single_person: true,
    text: false,
    watermark: false,
    logo: false,
    border: false,
  },
  negative_prompt: [
    "hyperreal CGI",
    "3D render",
    "CGI skin",
    "AI-looking face",
    "uncanny valley",
    "plastic skin",
    "wax skin",
    "porcelain skin",
    "airbrushed skin",
    "beauty filter",
    "face filter",
    "perfect flawless skin",
    "extreme pore detail",
    "fake pores",
    "uniform pores",
    "overprocessed skin texture",
    "overly detailed skin",
    "over-sharpened image",
    "excessive clarity",
    "HDR",
    "overprocessed HDR",
    "extreme dynamic range",
    "cinematic orange grading",
    "teal and orange grading",
    "strong warm cast",
    "yellow skin cast",
    "orange skin",
    "dramatic studio lighting",
    "ring light",
    "beauty lighting",
    "hard flash",
    "dramatic rim light",
    "fashion editorial photography",
    "commercial beauty campaign",
    "perfect symmetry",
    "unnaturally symmetrical face",
    "perfectly centered composition",
    "sterile digital image",
    "excessive bokeh",
    "wide-angle facial distortion",
    "fisheye distortion",
    "overexposed highlights",
    "crushed shadows",
    "fake eye reflections",
    "overly glossy eyes",
    "excessive eye sharpening",
    "oversaturated colors",
    "illustration",
    "painting",
    "anime",
    "cartoon",
  ],
  person_description: {
    description: "",
  },
} as const;

export function influencerIdentityBlock(name: string, traits: string): string {
  const who = name.trim() || "the influencer";
  const look = traits.trim() || "natural, modern social-media creator look";
  return `The person is named "${who}". Character brief: ${look}. ${IDENTITY}`;
}

export function influencerHeroPersonDescription(name: string, traits: string): string {
  return [name.trim(), traits.trim()].filter(Boolean).join(". ");
}

export function influencerHeroRecipe(name: string, traits: string) {
  return {
    ...FACE_RECIPE,
    person_description: {
      description: influencerHeroPersonDescription(name, traits),
    },
  };
}

export function influencerHeroPrompt(
  name: string,
  traits: string,
  opts?: { hasReference?: boolean }
): string {
  const json = JSON.stringify(influencerHeroRecipe(name, traits));
  if (opts?.hasReference) {
    return `Use the attached reference photograph as the only identity. Keep that exact face, age, hair, skin, and person. Apply this photographic recipe. Do not invent a different person.\n${json}`;
  }
  return json;
}

export function influencerEditPrompt(shotId: InfluencerShotId): string {
  const shot =
    INFLUENCER_SHOTS.find((s) => s.id === shotId) ?? INFLUENCER_SHOTS[0];
  return [
    `The attached photo is identity only: same person (age, ethnicity, hair color and cut, skin tone, eye color, body type, outfit).`,
    `Shoot a brand-new photograph from a different camera, distance, and angle. Reconstruct how this person would look in 3D from THIS viewpoint.`,
    `Do not copy, paste, warp, collage, or stamp the reference face onto a new body.`,
    `Do not keep the same frontal facial crop, expression, or silhouette.`,
    `The face MUST change with perspective: foreshortening, occlusion, a different ear/cheek/jaw line, eyes that match this angle, and lighting on different planes of the face.`,
    `Hair falls differently. Expression can shift slightly. Pose is new. This is the same person, not the same picture.`,
    `Photorealistic iPhone photo. No text, logos, watermarks, or extra people. Do not use any written character description.`,
    `Camera for this shot: ${shot.framing}.`,
  ].join(" ");
}
