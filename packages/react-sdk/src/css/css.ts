import { createCssEngine, type TransformValue } from "@webstudio-is/css-engine";
import type { Asset, Assets } from "@webstudio-is/asset-uploader";
import type { Build } from "@webstudio-is/project-build";
import { getComponentNames } from "../components/components-utils";
import { getComponentMeta } from "../components";
import { componentAttribute, idAttribute } from "../tree";
import { addGlobalRules } from "./global-rules";
import { getStyleRules } from "./style-rules";

type Data = {
  assets: Asset[];
  breakpoints?: Build["breakpoints"];
  styles?: Build["styles"];
  styleSourceSelections?: Build["styleSourceSelections"];
};

export const createImageValueTransformer =
  (assets: Assets): TransformValue =>
  (styleValue) => {
    if (styleValue.type === "image" && styleValue.value.type === "asset") {
      const asset = assets.get(styleValue.value.value.id);
      if (asset === undefined) {
        return { type: "keyword", value: "none" };
      }
      return {
        type: "image",
        value: {
          type: "url",
          url: asset.path,
        },
      };
    }
  };

export const generateCssText = (data: Data) => {
  const assets = new Map<Asset["id"], Asset>(
    data.assets.map((asset) => [asset.id, asset])
  );
  const breakpoints = new Map(data.breakpoints);
  const styles = new Map(data.styles);
  const styleSourceSelections = new Map(data.styleSourceSelections);

  const engine = createCssEngine({ name: "ssr" });

  addGlobalRules(engine, { assets });

  for (const breakpoint of breakpoints.values()) {
    engine.addMediaRule(breakpoint.id, breakpoint);
  }

  for (const component of getComponentNames()) {
    const meta = getComponentMeta(component);
    const presetStyle = meta?.presetStyle;
    if (presetStyle !== undefined) {
      for (const [tag, style] of Object.entries(presetStyle)) {
        engine.addStyleRule(
          `${tag}:where([${componentAttribute}=${component}])`,
          {
            style,
          }
        );
      }
    }
  }

  const styleRules = getStyleRules(styles, styleSourceSelections);
  for (const { breakpointId, instanceId, style } of styleRules) {
    engine.addStyleRule(
      `[${idAttribute}="${instanceId}"]`,
      {
        breakpoint: breakpointId,
        style,
      },
      createImageValueTransformer(assets)
    );
  }

  return engine.cssText;
};