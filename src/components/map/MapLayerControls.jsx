const LAYERS = [
  { key: 'analysis', label: '상권 분석' },
  { key: 'closures', label: '폐업 위치' },
]

export default function MapLayerControls({ visibleLayers, onToggle }) {
  return (
    <fieldset className="map-layer-controls">
      <legend>지도 레이어</legend>
      {LAYERS.map((layer) => (
        <label key={layer.key}>
          <input
            type="checkbox"
            checked={visibleLayers[layer.key]}
            onChange={() => onToggle(layer.key)}
          />
          <span>{layer.label}</span>
        </label>
      ))}
    </fieldset>
  )
}
