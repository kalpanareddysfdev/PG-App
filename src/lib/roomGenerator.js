/**
 * Room number generator for bulk room creation
 *
 * Usage:
 *   const spec = {
 *     floors: 4,
 *     roomsPerFloor: [9, 9, 9, 8],
 *     sharingTypes: [
 *       { capacity: 2, count: 19, rent: 5000, floorIndices: [0, 1, 2] },
 *       { capacity: 3, count: 16, rent: 6000, floorIndices: [0, 1, 2, 3] }
 *     ]
 *   };
 *   const rooms = generateRooms(spec, existingRooms);
 */

export function generateRooms(spec, existingRooms = []) {
  const rooms = [];
  const existingNumbers = new Set(existingRooms.map(r => r.name));

  let sharingIndex = 0;
  let countInCurrentSharing = 0;

  for (let floor = 0; floor < spec.floors; floor++) {
    const roomsInThisFloor = spec.roomsPerFloor[floor] || 0;

    for (let i = 0; i < roomsInThisFloor; i++) {
      // Find the next sharing type that applies to this floor
      while (
        sharingIndex < spec.sharingTypes.length &&
        (countInCurrentSharing >= spec.sharingTypes[sharingIndex].count ||
         !spec.sharingTypes[sharingIndex].floorIndices.includes(floor))
      ) {
        if (countInCurrentSharing >= spec.sharingTypes[sharingIndex].count) {
          sharingIndex++;
          countInCurrentSharing = 0;
        } else if (!spec.sharingTypes[sharingIndex].floorIndices.includes(floor)) {
          // Skip to a sharing type that covers this floor
          const nextIndex = spec.sharingTypes.findIndex(
            (st, idx) => idx > sharingIndex && st.floorIndices.includes(floor)
          );
          if (nextIndex === -1) {
            // No more sharing types for this floor, move to next
            break;
          }
          sharingIndex = nextIndex;
          countInCurrentSharing = 0;
        }
      }

      if (sharingIndex >= spec.sharingTypes.length) {
        break; // No more sharing types
      }

      const sharingType = spec.sharingTypes[sharingIndex];
      if (!sharingType.floorIndices.includes(floor)) {
        continue; // Skip if this sharing type doesn't apply to this floor
      }

      // Generate room number: floor * 100 + index (e.g., 101, 102, 201, 202)
      let roomNumber = String((floor + 1) * 100 + i + 1);

      // Handle ground floor prefix (optional)
      if (floor === 0 && spec.groundFloorPrefix) {
        roomNumber = spec.groundFloorPrefix + (i + 1).toString().padStart(2, '0');
      }

      // Skip if room number already exists
      if (existingNumbers.has(roomNumber)) {
        continue;
      }

      rooms.push({
        id: null, // Will be set by the action (newId('room'))
        propertyId: null, // Will be set by the action
        name: roomNumber,
        floor: String(floor + 1),
        capacity: sharingType.capacity,
        rent: sharingType.rent,
        amenities: [],
        ac: false
      });

      countInCurrentSharing++;
    }
  }

  return rooms;
}

/**
 * Validate bulk room spec
 * Returns array of errors (empty if valid)
 */
export function validateBulkSpec(spec) {
  const errors = [];

  if (!spec.floors || spec.floors < 1) {
    errors.push('Number of floors must be at least 1');
  }

  if (!spec.roomsPerFloor || spec.roomsPerFloor.length === 0) {
    errors.push('Must specify rooms per floor');
  }

  if (spec.roomsPerFloor.length !== spec.floors) {
    errors.push('Rooms per floor array must match number of floors');
  }

  if (!spec.sharingTypes || spec.sharingTypes.length === 0) {
    errors.push('Must specify at least one sharing type');
  }

  let totalCount = 0;
  spec.sharingTypes?.forEach((st, idx) => {
    if (!st.capacity || st.capacity < 1) {
      errors.push(`Sharing type ${idx} must have capacity >= 1`);
    }
    if (!st.count || st.count < 1) {
      errors.push(`Sharing type ${idx} must have count >= 1`);
    }
    if (st.rent < 0) {
      errors.push(`Sharing type ${idx} rent cannot be negative`);
    }
    totalCount += st.count;
  });

  const totalRooms = spec.roomsPerFloor.reduce((a, b) => a + b, 0);
  if (totalCount > totalRooms) {
    errors.push(`Total sharing types (${totalCount}) exceeds total rooms (${totalRooms})`);
  }

  return errors;
}

/**
 * Calculate suggested rooms per floor distribution
 */
export function suggestRoomsPerFloor(totalRooms, floorCount) {
  const roomsPerFloor = [];
  const roomsPerFloorBase = Math.floor(totalRooms / floorCount);
  const remainder = totalRooms % floorCount;

  for (let i = 0; i < floorCount; i++) {
    roomsPerFloor.push(roomsPerFloorBase + (i < remainder ? 1 : 0));
  }

  return roomsPerFloor;
}
