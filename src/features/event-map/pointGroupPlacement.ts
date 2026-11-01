export interface PointGroupPlacementInput {
  anchorX: number;
  anchorY: number;
  positioned: boolean;
  wrapLeft: number;
  wrapTop: number;
  wrapWidth: number;
  wrapHeight: number;
  viewportLeft?: number;
  viewportTop?: number;
  viewportWidth: number;
  viewportHeight: number;
  naturalHeight: number;
  headerHeight: number;
  preferredWidth?: number;
  margin?: number;
  gap?: number;
}

export interface PointGroupPlacement {
  left: number;
  top: number;
  width: number;
  listMaxHeight: number;
  tailAbove: boolean;
  tailLeft: number;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/** Держит список точки внутри карты и внутри окна. */
export function placePointGroupModal(input: PointGroupPlacementInput): PointGroupPlacement {
  const margin = input.margin ?? 8;
  const gap = input.gap ?? 12;
  const preferredWidth = input.preferredWidth ?? 300;
  const viewOriginLeft = input.viewportLeft ?? 0;
  const viewOriginTop = input.viewportTop ?? 0;
  const viewLeft = viewOriginLeft + margin;
  const viewTop = viewOriginTop + margin;
  const viewRight = viewOriginLeft + input.viewportWidth - margin;
  const viewBottom = viewOriginTop + input.viewportHeight - margin;

  const boundsLeft = Math.max(input.wrapLeft + margin, viewLeft);
  const boundsTop = Math.max(input.wrapTop + margin, viewTop);
  const boundsRight = Math.min(input.wrapLeft + input.wrapWidth - margin, viewRight);
  const boundsBottom = Math.min(input.wrapTop + input.wrapHeight - margin, viewBottom);

  const boundsWidth = Math.max(0, boundsRight - boundsLeft);
  const boundsHeight = Math.max(0, boundsBottom - boundsTop);
  const width = Math.min(preferredWidth, boundsWidth);
  const headerHeight = Math.max(0, input.headerHeight);
  const listNatural = Math.min(240, Math.max(0, input.naturalHeight - headerHeight));

  const finish = (pageLeft: number, pageTop: number, listMaxHeight: number, tailAbove: boolean): PointGroupPlacement => {
    const left = pageLeft - input.wrapLeft;
    return {
      left,
      top: pageTop - input.wrapTop,
      width,
      listMaxHeight,
      tailAbove,
      tailLeft: clamp(input.anchorX - left - 7, 12, Math.max(12, width - 26)),
    };
  };

  if (!input.positioned) {
    const listMaxHeight = Math.min(listNatural, Math.max(0, boundsHeight - headerHeight));
    const height = headerHeight + listMaxHeight;
    const pageLeft = clamp(
      input.wrapLeft + (input.wrapWidth - width) / 2,
      boundsLeft,
      boundsLeft + Math.max(0, boundsWidth - width),
    );
    const pageTop = clamp(
      boundsBottom - height - 16,
      boundsTop,
      boundsTop + Math.max(0, boundsHeight - height),
    );
    return finish(pageLeft, pageTop, listMaxHeight, false);
  }

  const anchorPageX = input.wrapLeft + input.anchorX;
  const anchorPageY = input.wrapTop + input.anchorY;
  const spaceAbove = anchorPageY - gap - boundsTop;
  const spaceBelow = boundsBottom - (anchorPageY + gap);
  const desired = headerHeight + listNatural;
  const tailAbove = spaceAbove >= desired || (spaceBelow < desired && spaceAbove >= spaceBelow);
  const available = Math.max(0, tailAbove ? spaceAbove : spaceBelow);
  const listMaxHeight = Math.min(
    listNatural,
    Math.max(0, Math.min(available, boundsHeight) - headerHeight),
  );
  const height = headerHeight + listMaxHeight;
  const pageLeft = clamp(
    anchorPageX - width / 2,
    boundsLeft,
    boundsLeft + Math.max(0, boundsWidth - width),
  );
  const pageTop = clamp(
    tailAbove ? anchorPageY - gap - height : anchorPageY + gap,
    boundsTop,
    boundsTop + Math.max(0, boundsHeight - height),
  );
  return finish(pageLeft, pageTop, listMaxHeight, tailAbove);
}
