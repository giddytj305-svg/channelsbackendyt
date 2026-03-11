const { channels } = require('../data/channels');
const YouTubeService = require('../lib/youtube');

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
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
    // Initialize YouTube service if API key exists
    let enhancedChannels = [...channels];
    
    if (process.env.YOUTUBE_API_KEY) {
      const youtube = new YouTubeService(process.env.YOUTUBE_API_KEY);
      
      // Get latest channel details from YouTube
      const channelIds = channels.map(c => c.channelId);
      const youtubeChannels = await youtube.getChannelDetails(channelIds);
      
      // Enhance channel data with YouTube info
      enhancedChannels = channels.map(channel => {
        const ytChannel = youtubeChannels.find(yc => yc.id === channel.channelId);
        if (ytChannel) {
          return {
            ...channel,
            logo: ytChannel.snippet.thumbnails.default.url,
            description: ytChannel.snippet.description,
            subscriberCount: ytChannel.statistics.subscriberCount,
            videoCount: ytChannel.statistics.videoCount
          };
        }
        return channel;
      });
    }

    // Send response
    res.writeHead(200, headers);
    res.end(JSON.stringify({
      channels: enhancedChannels,
      total: enhancedChannels.length,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error in /api/channels:', error);
    
    // Fallback to basic channel data
    res.writeHead(200, headers);
    res.end(JSON.stringify({
      channels,
      total: channels.length,
      timestamp: new Date().toISOString(),
      warning: 'Using cached channel data'
    }));
  }
};
