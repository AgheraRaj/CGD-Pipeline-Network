"use client";

import { useCallback, useState } from "react";

export type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
};

export type DeviceLocationState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "success"; location: DeviceLocation }
  | { status: "error"; message: string };

function describeError(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location access is blocked. Allow location for this site in your browser settings (the lock icon next to the address bar), then tap Try again. A report cannot be sent without a location.";
    case error.POSITION_UNAVAILABLE:
      return "Your device could not work out its location. Check that location services or GPS are turned on, then try again.";
    case error.TIMEOUT:
      return "Finding your location took too long. Move to an open area and try again.";
    default:
      return "Your location could not be read. Please try again.";
  }
}

export function useDeviceLocation() {
  const [state, setState] = useState<DeviceLocationState>({ status: "idle" });

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({
        status: "error",
        message: "This browser does not support location. Use a current version of Chrome, Edge, Firefox or Safari.",
      });
      return;
    }
    if (!window.isSecureContext) {
      setState({
        status: "error",
        message: "Location only works on a secure (HTTPS) connection or on localhost.",
      });
      return;
    }

    setState({ status: "requesting" });
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setState({
          status: "success",
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            capturedAt: new Date(position.timestamp).toISOString(),
          },
        }),
      (error) => setState({ status: "error", message: describeError(error) }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, []);

  return { state, request };
}