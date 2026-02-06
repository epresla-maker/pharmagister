import Parser from 'rss-parser';
import { NextResponse } from 'next/server';

const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['media:content', 'mediaContent'],
    ]
  }
});

export async function GET() {
  try {
    // Semmelweis Egyetem RSS feed URL
    const feedUrl = 'https://semmelweis.hu/hirek/feed';
    
    const feed = await parser.parseURL(feedUrl);
    
    // Feldolgozzuk a cikkeket pharmagister formátumra
    const posts = feed.items.map((item, index) => {
      // A cikk képének kinyerése (első kép a contentEncoded-ból vagy media:content)
      let imageUrl = null;
      
      // Próbáljuk meg a képet a content-ből kinyerni
      if (item.contentEncoded || item.content) {
        const content = item.contentEncoded || item.content;
        const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
        if (imgMatch && imgMatch[1]) {
          imageUrl = imgMatch[1];
        }
      }
      
      // Ha van media:content
      if (!imageUrl && item.mediaContent && item.mediaContent.$?.url) {
        imageUrl = item.mediaContent.$.url;
      }
      
      // Rövid leírás generálása (első 200 karakter a content-ből, HTML tagek nélkül)
      let description = '';
      if (item.contentEncoded || item.content) {
        const content = item.contentEncoded || item.content;
        description = content
          .replace(/<[^>]*>/g, '') // HTML tagek eltávolítása
          .trim()
          .substring(0, 200) + '...';
      } else if (item.description) {
        description = item.description
          .replace(/<[^>]*>/g, '')
          .trim()
          .substring(0, 200) + '...';
      }
      
      return {
        id: `rss-semmelweis-${item.guid || index}`,
        type: 'rss',
        source: 'semmelweis',
        title: item.title,
        description: description,
        link: item.link,
        imageUrl: imageUrl,
        pubDate: item.pubDate,
        isoDate: item.isoDate,
        categories: item.categories || [],
        creator: item.creator || 'Semmelweis Egyetem',
        guid: item.guid,
      };
    });
    
    return NextResponse.json({
      success: true,
      feedTitle: feed.title,
      feedDescription: feed.description,
      feedLink: feed.link,
      posts: posts,
      totalItems: posts.length,
    });
    
  } catch (error) {
    console.error('RSS fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
