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
        results: []
      }));
      return;
    }

    // Get search query
    const { q, max = 20 } = req.query;
    
    if (!q || q.trim() === '') {
      res.writeHead(400, headers);
      res.end(JSON.stringify({ 
        error: 'Search query required',
        results: []
      }));
      return;
    }

    const youtube = new YouTubeService(process.env.YOUTUBE_API_KEY);
    
    // Search for live streams
    const results = await youtube.searchLiveStreams(q, parseInt(max));
    
    // Format the response
    const formattedResults = results.map(result => ({
      id: result.id.videoId,
      channel: {
        id: result.snippet.channelId,
        name: result.snippet.channelTitle
      },
      title: result.snippet.title,
      description: result.snippet.description,
      videoId: result.id.videoId,
      embedUrl: `https://www.youtube.com/embed/${result.id.videoId}?autoplay=1&mute=1`,
      thumbnail: result.snippet.thumbnails.high?.url || result.snippet.thumbnails.default.url,
      publishedAt: result.snippet.publishedAt,
      liveDetails: result.liveDetails,
      live: true
    }));

    // Send response
    res.writeHead(200, headers);
    res.end(JSON.stringify({
      query: q,
      results: formattedResults,
      total: formattedResults.length,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error in /api/search:', error);
    
    res.writeHead(500, headers);
    res.end(JSON.stringify({ 
      error: 'Failed to search live streams',
      message: error.message,
      results: []
    }));
  }
};
