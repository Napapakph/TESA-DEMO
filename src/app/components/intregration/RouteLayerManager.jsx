import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import L from "leaflet";

const RouteLayerManager = forwardRef(function RouteLayerManager(
  { mapRef, dronePosition, isMapReady },
  ref,
) {
  const routeLayerRef = useRef(null);
  const routeLineRef = useRef(null);
  const targetMarkerRef = useRef(null);
  const targetLatLngRef = useRef(null);

  const clearRoute = useCallback(() => {
    if (routeLayerRef.current && routeLineRef.current) {
      routeLayerRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    if (routeLayerRef.current && targetMarkerRef.current) {
      routeLayerRef.current.removeLayer(targetMarkerRef.current);
      targetMarkerRef.current = null;
    }
    targetLatLngRef.current = null;
  }, []);

  const ensureLayer = useCallback(() => {
    const map = mapRef.current;
    if (!map) return null;

    let layer = routeLayerRef.current;
    if (!layer) {
      layer = L.layerGroup().addTo(map);
      routeLayerRef.current = layer;
    } else if (!map.hasLayer(layer)) {
      layer.addTo(map);
    }
    return layer;
  }, [mapRef]);

  const drawRoute = useCallback(
    (start, target) => {
      if (!start || !target) return;
      const map = mapRef.current;
      if (!map) return;

      const layer = ensureLayer();
      if (!layer) return;

      clearRoute();

      const line = L.polyline(
        [
          [start.lat, start.lng],
          [target.lat, target.lng],
        ],
        {
          color: "#38bdf8",
          weight: 2,
          dashArray: "6 8",
          className: "route-path",
          interactive: false,
        },
      );

      routeLineRef.current = line;
      layer.addLayer(line);

      const targetIcon = L.divIcon({
        className: "route-target-icon",
        html: '<div class="route-target"><div class="route-target-core"></div></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([target.lat, target.lng], {
        icon: targetIcon,
        interactive: false,
      });

      targetMarkerRef.current = marker;
      targetLatLngRef.current = target;
      layer.addLayer(marker);
    },
    [clearRoute, ensureLayer, mapRef],
  );

  useEffect(() => {
    if (!isMapReady) return undefined;
    const map = mapRef.current;
    if (!map) return undefined;

    const layer = ensureLayer();

    return () => {
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
      routeLayerRef.current = null;
      routeLineRef.current = null;
      targetMarkerRef.current = null;
      targetLatLngRef.current = null;
    };
  }, [ensureLayer, isMapReady, mapRef]);

  useEffect(() => {
    if (!routeLineRef.current || !targetLatLngRef.current) return;
    if (!dronePosition) return;

    routeLineRef.current.setLatLngs([
      [dronePosition.lat, dronePosition.lng],
      [targetLatLngRef.current.lat, targetLatLngRef.current.lng],
    ]);
  }, [dronePosition]);

  useImperativeHandle(
    ref,
    () => ({
      drawRoute,
      clearRoute,
    }),
    [clearRoute, drawRoute],
  );

  return null;
});

export default RouteLayerManager;
