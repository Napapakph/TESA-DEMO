# Drone Status & Camera Panel Enhancements

## Goal
Transform the drone status sidebar into a rolling log with max 10 cards and color-coded camera badges, manage drone images with “view more” popup, and ensure the Camera Credentials pane only displays API-fetched information.

## Steps
1. Update data model & socket handling in [src/app/DefenseDashboard.jsx](src/app/DefenseDashboard.jsx)
   - Maintain a dedicated `droneCards` state separate from live marker tracking.
   - On incoming socket payloads: append new entries for unseen drone IDs; if the ID reappears within 5 seconds, mutate the existing card’s coordinates/metadata instead of pushing a new one.
   - Enforce a cap of 10 cards (remove oldest) and keep per-drone image queues limited to the two most recent frames (record timestamps).

2. Render drone cards with new logic
   - Display cards inside `.drone-list` with scroll overflow; include timestamp, coordinates, camera badge (deterministic color per camera ID), and inline thumbnails when available.
   - When a drone has more than two images, convert the card to a text-first layout with a “View more” button that opens the overflow gallery.

3. Implement image popup modal
   - Manage popup state in the dashboard component; when “View more” is clicked, show a modal adjacent to the sidebar with the remaining images and a close button.
   - Ensure popup cleanup on close/navigation.

4. Adjust Camera Credentials panel
   - Remove display of socket-provided camera info; populate details solely from `/api/object-detection/info/{cam_id}` response (mask token, show labelled fields, fall back gracefully).

5. Update styles in [src/app/styles/defense-dashboard.css](src/app/styles/defense-dashboard.css)
   - Add styling for card badges, thumbnail grid, popup modal, and updated camera-pane visuals.
   - Keep responsive behavior and consistent theme aesthetics.
