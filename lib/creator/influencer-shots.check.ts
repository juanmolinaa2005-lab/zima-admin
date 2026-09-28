import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  FACE_IMAGE_SIZE,
  FACE_SHOT_ID,
  influencerEditPrompt,
  influencerHeroPersonDescription,
  influencerHeroPrompt,
  influencerHeroRecipe,
} from "./influencer-shots";
import { buildInfluencerShotInserts } from "./influencer-worker";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const name = "Maya";
const traits = "mujer de 28 años, pelo rizado castaño, ojos verdes, piel con pecas, estilo casual";
const recipe = influencerHeroRecipe(name, traits);
assert(recipe.subject.person_description === "", "subject fields stay empty");
assert(recipe.subject.identity_description === "", "identity field stays empty");
assert(recipe.output.aspect_ratio === "4:5", "face still is 4:5");
assert(recipe.image_type.genre === "close-up facial portrait", "close-up genre");
assert(
  recipe.person_description.description === influencerHeroPersonDescription(name, traits),
  "only person_description is filled"
);
assert(
  recipe.person_description.description.includes(traits),
  "character brief lands in person_description"
);
assert(FACE_IMAGE_SIZE.width / FACE_IMAGE_SIZE.height === 4 / 5, "pixel size is 4:5");

const plain = influencerHeroPrompt(name, traits);
const parsed = JSON.parse(plain) as typeof recipe;
assert(parsed.person_description.description.includes("Maya"), "JSON prompt includes the name");
assert(parsed.subject.hair_description === "", "hair is not parsed into subject");
assert(Array.isArray(parsed.negative_prompt) && parsed.negative_prompt.includes("plastic skin"), "keeps negatives");

const withRef = influencerHeroPrompt(name, traits, { hasReference: true });
assert(/attached reference photograph/i.test(withRef), "reference prompt keeps identity from the photo");
assert(withRef.includes(plain) || withRef.includes(traits), "reference prompt still carries the recipe");
const jsonStart = withRef.indexOf("{");
assert(jsonStart > 0, "reference prompt prefixes the JSON");
const fromRef = JSON.parse(withRef.slice(jsonStart)) as typeof recipe;
assert(fromRef.person_description.description.includes(traits), "reference JSON still has the brief");
assert(fromRef.subject.person_description === "", "reference JSON does not fill subject");

const inserts = buildInfluencerShotInserts({
  influencerId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  userId: "33333333-3333-4333-8333-333333333333",
  name,
  traits: "",
  faceReferenceUrl: "https://cdn.example/face.jpg",
});
const face = inserts.find((row) => row.shot_key === FACE_SHOT_ID);
assert(face, "creates the rostro shot");
assert(face!.reference_url === "https://cdn.example/face.jpg", "uploaded face is stored on rostro");
assert(String(face!.prompt).includes("attached reference photograph"), "rostro prompt uses the photo");
assert(face!.image_size === "4:5", "rostro stores 4:5");
const other = inserts.find((row) => row.shot_key !== FACE_SHOT_ID);
assert(other!.reference_url === null, "other shots wait for the generated face");
const edit = influencerEditPrompt("face-three-quarter");
assert(/brand-new photograph/i.test(edit), "later shots are a new photo");
assert(/must change with perspective/i.test(edit), "face changes with camera angle");
assert(/do not copy, paste/i.test(edit), "forbids stamping the frontal face");
assert(!/exact same face/i.test(edit), "does not lock an identical face crop");
assert(/head is physically turned/i.test(String(other!.prompt)), "3/4 shot asks for a real head turn");

const here = path.dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(path.join(here, "./influencer-worker.ts"), "utf8");
assert(workerSrc.includes("influencerEditPrompt("), "worker rebuilds angle prompts at generate time");
assert(workerSrc.includes("generateOpenAIImage"), "rostro uses OpenAI generations");
assert(workerSrc.includes("editOpenAIImage"), "reference photos use OpenAI edits");
assert(workerSrc.includes("OPENAI_IMAGE_MODEL"), "model is gpt-image-2");
assert(!workerSrc.includes("FAL_FLUX_2_PRO"), "influencer stills do not use FLUX");

const videoWorkerSrc = readFileSync(path.join(here, "./influencer-video-worker.ts"), "utf8");
assert(videoWorkerSrc.includes("editOpenAIImages"), "start frame uses OpenAI edits");
assert(videoWorkerSrc.includes("OPENAI_IMAGE_MODEL"), "start frame is gpt-image-2");
assert(videoWorkerSrc.includes("extractVideoStartFrames"), "clone start frame uses video stills");
assert(videoWorkerSrc.includes("influencerMotionRefs"), "clone binds the influencer face");
assert(videoWorkerSrc.includes("imageUrl: startUrl"), "kling start stays the generated frame");
assert(!videoWorkerSrc.includes("FAL_FLUX_2_PRO_EDIT"), "start frame does not use FLUX");
assert(!videoWorkerSrc.includes("REPLICATE_FLUX_KONTEXT_PRO"), "start frame does not use Kontext");

console.log("influencer face prompt checks ok");
