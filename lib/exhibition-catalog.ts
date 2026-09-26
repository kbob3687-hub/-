import { seedArtifacts, type Artifact } from "@/lib/artifact";
import { constellationSamples, isConstellationSample } from "@/lib/constellation-samples";

const seedIds = new Set(seedArtifacts.map(item => item.id));

export function isExhibitionSample(id: string) {
  return seedIds.has(id) || isConstellationSample(id);
}

// Both exhibition views and their detail panels use this same public catalogue.
export function createExhibitionCatalog(artifacts: Artifact[]): Artifact[] {
  const seen = new Set<string>();
  return [...artifacts, ...seedArtifacts, ...constellationSamples].filter(item => {
    if (!item.isPublic || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
