const axios = require('axios');

// Calculate distance between two coordinates in km
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const toRad = (value) => {
  return value * Math.PI / 180;
};

// Get address from coordinates (reverse geocoding)
const getAddressFromCoords = async (latitude, longitude) => {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse`,
      {
        params: {
          lat: latitude,
          lon: longitude,
          format: 'json',
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'THEEKTHAK-App/1.0'
        }
      }
    );

    if (response.data && response.data.address) {
      const addr = response.data.address;
      const addressParts = [];
      
      if (addr.road) addressParts.push(addr.road);
      if (addr.suburb) addressParts.push(addr.suburb);
      if (addr.city || addr.town || addr.village) {
        addressParts.push(addr.city || addr.town || addr.village);
      }
      if (addr.state) addressParts.push(addr.state);
      if (addr.postcode) addressParts.push(addr.postcode);
      
      return addressParts.join(', ');
    }
    
    return 'Location not found';
  } catch (error) {
    console.error('Geocoding error:', error);
    return 'Location not found';
  }
};

// Get coordinates from address (geocoding)
const getCoordsFromAddress = async (address) => {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search`,
      {
        params: {
          q: address,
          format: 'json',
          limit: 1
        },
        headers: {
          'User-Agent': 'THEEKTHAK-App/1.0'
        }
      }
    );

    if (response.data && response.data.length > 0) {
      return {
        latitude: parseFloat(response.data[0].lat),
        longitude: parseFloat(response.data[0].lon)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

module.exports = {
  calculateDistance,
  getAddressFromCoords,
  getCoordsFromAddress
};