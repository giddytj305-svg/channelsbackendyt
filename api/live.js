const { channels } = require('../data/channels');
const YouTubeService = require('../lib/youtube');

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=60'
};

module.exports = async (req, res) => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  // Only allow GET
  if (req.method !== 'GET') {
    res.writeHead(405, headers);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    // Check for API key
    if (!process.env.YOUTUBE_API_KEY) {
      res.writeHead(500, headers);
      res.end(JSON.stringify({ 
        error: 'YouTube API key not configured',
        liveStreams: []
      }));
      return;
    }

    const youtube = new YouTubeService(process.env.YOUTUBE_API_KEY);
    
    // Get channel IDs from preloaded channels
    const channelIds = channels.map(c => c.channelId);
    
    // Try to fetch live streams from preloaded channels first
    let liveStreams = await youtube.getLiveStreams(channelIds);
    let formattedStreams = [];
    let source = 'preloaded';
    
    // If no streams from preloaded channels, search for popular live news
    if (!liveStreams || liveStreams.length === 0) {
      console.log('No streams from preloaded channels, searching for live news...');
      
      // Search for live news streams
      const searchResults = await youtube.searchLiveStreams('live news', 15);
      liveStreams = searchResults;
      source = 'search';
    }
    
    // Format the streams
    if (liveStreams && liveStreams.length > 0) {
      formattedStreams = liveStreams.map(stream => {
        // Try to find channel in preloaded list
        const channel = channels.find(c => 
          c.channelId === stream.snippet.channelId
        );
        
        return {
          id: stream.id.videoId || stream.id,
          channel: {
            id: channel?.id || stream.snippet.channelId,
            name: channel?.name || stream.snippet.channelTitle,
            country: channel?.country || this.guessCountry(stream.snippet.channelTitle) || 'International',
            logo: channel?.logo || stream.snippet.thumbnails.default?.url || 'https://via.placeholder.com/50'
          },
          title: stream.snippet.title,
          description: stream.snippet.description,
          videoId: stream.id.videoId || stream.id,
          embedUrl: `https://www.youtube.com/embed/${stream.id.videoId || stream.id}?autoplay=0&mute=1`,
          thumbnail: stream.snippet.thumbnails.high?.url || stream.snippet.thumbnails.default?.url,
          publishedAt: stream.snippet.publishedAt,
          liveDetails: stream.liveDetails || null,
          live: true,
          source: source // Indicates if from preloaded or search
        };
      });
    }

    // Also get popular categories if no streams
    if (formattedStreams.length === 0) {
      // Try different search terms
      const searchTerms = ['breaking news', 'live stream', 'news live', 'sports live'];
      
      for (const term of searchTerms) {
        const results = await youtube.searchLiveStreams(term, 5);
        if (results && results.length > 0) {
          formattedStreams = results.map(stream => ({
            id: stream.id.videoId || stream.id,
            channel: {
              name: stream.snippet.channelTitle,
              country: 'International'
            },
            title: stream.snippet.title,
            videoId: stream.id.videoId || stream.id,
            embedUrl: `https://www.youtube.com/embed/${stream.id.videoId || stream.id}?autoplay=0&mute=1`,
            thumbnail: stream.snippet.thumbnails.high?.url || stream.snippet.thumbnails.default?.url,
            live: true,
            source: 'fallback'
          }));
          break;
        }
      }
    }

    // Send response
    res.writeHead(200, headers);
    res.end(JSON.stringify({
      liveStreams: formattedStreams,
      total: formattedStreams.length,
      timestamp: new Date().toISOString(),
      source: source,
      message: formattedStreams.length === 0 ? 
        'No live streams found at the moment. Try searching for specific channels.' : 
        `Found ${formattedStreams.length} live streams`
    }));
    
  } catch (error) {
    console.error('Error in /api/live:', error);
    
    // Even on error, try to return something useful
    try {
      const youtube = new YouTubeService(process.env.YOUTUBE_API_KEY);
      const fallbackStreams = await youtube.searchLiveStreams('news', 10);
      
      const formattedFallback = fallbackStreams.map(stream => ({
        id: stream.id.videoId,
        channel: { name: stream.snippet.channelTitle, country: 'International' },
        title: stream.snippet.title,
        videoId: stream.id.videoId,
        embedUrl: `https://www.youtube.com/embed/${stream.id.videoId}?autoplay=0&mute=1`,
        thumbnail: stream.snippet.thumbnails.high?.url,
        live: true
      }));
      
      res.writeHead(200, headers);
      res.end(JSON.stringify({ 
        liveStreams: formattedFallback,
        total: formattedFallback.length,
        timestamp: new Date().toISOString(),
        warning: 'Used fallback search due to error'
      }));
    } catch (fallbackError) {
      res.writeHead(500, headers);
      res.end(JSON.stringify({ 
        error: 'Failed to fetch live streams',
        message: error.message,
        liveStreams: []
      }));
    }
  }
};

// Helper to guess country from channel name
function guessCountry(channelName) {
  const countryMap = {
    'kenya': 'Kenya',
    'ntv': 'Kenya',
    'citizen': 'Kenya',
    'ktn': 'Kenya',
    'bbc': 'UK',
    'sky': 'UK',
    'al jazeera': 'Qatar',
    'france': 'France',
    'dw': 'Germany',
    'cgtn': 'China',
    'nbc': 'USA',
    'bloomberg': 'USA',
    'cnn': 'USA',
    'fox': 'USA',
    'abc': 'USA',
    'cbs': 'USA'
  };
  
  const lower = channelName.toLowerCase();
  for (const [key, country] of Object.entries(countryMap)) {
    if (lower.includes(key)) {
      return country;
    }
  }
  return null;
}
