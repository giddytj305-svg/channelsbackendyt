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
    
    // Get channel IDs
    const channelIds = channels.map(c => c.channelId);
    
    // Fetch live streams
    const liveStreams = await youtube.getLiveStreams(channelIds);
    
    // Format the response
    const formattedStreams = liveStreams.map(stream => {
      const channel = channels.find(c => c.channelId === stream.snippet.channelId);
      
      return {
        id: stream.id.videoId,
        channel: {
          id: channel?.id || stream.snippet.channelId,
          name: channel?.name || stream.snippet.channelTitle,
          country: channel?.country || 'Unknown',
          logo: channel?.logo || stream.snippet.thumbnails.default.url
        },
        title: stream.snippet.title,
        description: stream.snippet.description,
        videoId: stream.id.videoId,
        embedUrl: `https://www.youtube.com/embed/${stream.id.videoId}?autoplay=1&mute=1`,
        thumbnail: stream.snippet.thumbnails.high?.url || stream.snippet.thumbnails.default.url,
        publishedAt: stream.snippet.publishedAt,
        liveDetails: stream.liveDetails,
        live: true
      };
    });

    // Send response
    res.writeHead(200, headers);
    res.end(JSON.stringify({
      liveStreams: formattedStreams,
      total: formattedStreams.length,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error in /api/live:', error);
    
    res.writeHead(500, headers);
    res.end(JSON.stringify({ 
      error: 'Failed to fetch live streams',
      message: error.message,
      liveStreams: []
    }));
  }
};
