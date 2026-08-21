import type { MetadataRoute } from "next";
import { buildEditorRobotsDocument } from "@magazine/domain";

export default function robots(): MetadataRoute.Robots {
  return buildEditorRobotsDocument();
}
