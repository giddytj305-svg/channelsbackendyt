const fetch = require('node-fetch');
const NodeCache = require('node-cache');

// Initialize cache with 5 minutes TTL
const cache = new NodeCache({ stdTTL: 300 });

class YouTubeService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }

  // Helper to make API requests with caching
  async makeRequest(endpoint, params, cacheKey, ttl = 300) {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for ${cacheKey}`);
      return cached;
    }

    // Build URL
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    url.searchParams.append('key', this.apiKey);
    Object.keys(params).forEach(key => 
      url.searchParams.append(key, params[key])
    );

    try {
      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.error) {
        throw new Error(`YouTube API error: ${data.error.message}`);
      }

      // Cache the response
      cache.set(cacheKey, data, ttl);
      return data;
    } catch (error) {
      console.error('YouTube API request failed:', error);
      throw error;
    }
  }

  // Get channel details by ID
  async getChannelDetails(channelIds) {
    const cacheKey = `channels_${channelIds.join('_')}`;
    
    const data = await this.makeRequest('channels', {
      part: 'snippet,statistics',
      id: channelIds.join(','),
      maxResults: 50
    }, cacheKey);

    return data.items || [];
  }

  // Get live streams for channels
  async getLiveStreams(channelIds) {
    const cacheKey = `live_${channelIds.join('_')}`;
    
    // First, search for live events from these channels
    const data = await this.makeRequest('search', {
      part: 'snippet',
      channelId: channelIds.join(','),
      eventType: 'live',
      type: 'video',
      maxResults: 50
    }, cacheKey, 60); // Shorter TTL for live data

    if (!data.items || data.items.length === 0) {
      return [];
    }

    // Get video details for live streams
    const videoIds = data.items.map(item => item.id.videoId);
    const videosData = await this.makeRequest('videos', {
      part: 'snippet,liveStreamingDetails',
      id: videoIds.join(',')
    }, `videos_${videoIds.join('_')}`, 60);

    // Combine search results with video details
    return data.items.map(item => {
      const videoDetails = videosData.items?.find(v => v.id === item.id.videoId);
      return {
        ...item,
        liveDetails: videoDetails?.liveStreamingDetails || null
      };
    });
  }

  // Search for live streams by query
  async searchLiveStreams(query, maxResults = 20) {
    const cacheKey = `search_${query}_${maxResults}`;
    
    const data = await this.makeRequest('search', {
      part: 'snippet',
      q: query,
      eventType: 'live',
      type: 'video',
      maxResults
    }, cacheKey, 60);

    if (!data.items || data.items.length === 0) {
      return [];
    }

    // Get video details
    const videoIds = data.items.map(item => item.id.videoId);
    const videosData = await this.makeRequest('videos', {
      part: 'snippet,liveStreamingDetails',
      id: videoIds.join(',')
    }, `search_videos_${videoIds.join('_')}`, 60);

    return data.items.map(item => {
      const videoDetails = videosData.items?.find(v => v.id === item.id.videoId);
      return {
        ...item,
        liveDetails: videoDetails?.liveStreamingDetails || null
      };
    });
  }
}

module.exports = YouTubeService;
