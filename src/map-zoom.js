// У карты на телефоне базовая ширина может быть больше окна (min-width).
// Масштабируем именно от фактической ширины, а не от 100% окна: иначе
// кнопки +/- и pinch не меняют размер до пересечения порога min-width.
export function zoomFrame({ zoom, nextZoom, stageWidth, scrollLeft, scrollTop, anchorX, anchorY }) {
  const clamped = Math.min(3.5, Math.max(1, nextZoom))
  const factor = clamped / zoom
  return {
    zoom: clamped,
    width: stageWidth * factor,
    left: Math.max(0, (scrollLeft + anchorX) * factor - anchorX),
    top: Math.max(0, (scrollTop + anchorY) * factor - anchorY),
  }
}
