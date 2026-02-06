import Parser from 'rss-parser';
import { NextResponse } from 'next/server';

const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['media:content', 'mediaContent'],
    ]
  },
  timeout: 10000, // 10 másodperces timeout
  headers: {
    'User-Agent': 'Pharmagister RSS Reader',
  }
});

// Cache változók
let cachedFeed = null;
let lastFetchTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 perc

export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5 perc

export async function GET() {
  try {
    // Cache ellenőrzés
    const now = Date.now();
    if (cachedFeed && lastFetchTime && (now - lastFetchTime) < CACHE_DURATION) {
      return NextResponse.json(cachedFeed);
    }

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
          
          // Ha miniatűr kép, cseréljük nagyobbra
          // -175x120.jpg -> eredeti méret (eltávolítjuk a méret részt)
          imageUrl = imageUrl
            .replace(/-\d+x\d+\.jpg$/, '.jpg')
            .replace(/-\d+x\d+\.png$/, '.png')
            .replace(/-\d+x\d+\.jpeg$/, '.jpeg');
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
      
      // Firestore-safe ID generálása
      // Próbáljuk kinyerni a post ID-t az URL-ből (?p=164600)
      let postId = null;
      if (item.guid) {
        const match = item.guid.match(/[?&]p=(\d+)/);
        if (match) {
          postId = `rss-semmelweis-${match[1]}`;
        }
      }
      // Ha nem sikerült, hash-eljük a guid-ot vagy használjuk az indexet
      if (!postId) {
        // Egyszerű hash a guid-ból vagy link-ből
        const hashSource = item.guid || item.link || `${index}`;
        const simpleHash = hashSource.split('').reduce((acc, char) => {
          return ((acc << 5) - acc) + char.charCodeAt(0);
        }, 0);
        postId = `rss-semmelweis-${Math.abs(simpleHash)}`;
      }
      
      return {
        id: postId,
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
    
    const responseData = {
      success: true,
      feedTitle: feed.title,
      feedDescription: feed.description,
      feedLink: feed.link,
      posts: posts,
      totalItems: posts.length,
    };
    
    // Cache mentése
    cachedFeed = responseData;
    lastFetchTime = now;
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('RSS fetch error:', error);
    
    // Ha van cache, azt adjuk vissza hiba esetén is
    if (cachedFeed) {
      return NextResponse.json({
        ...cachedFeed,
        fromCache: true,
        cacheAge: lastFetchTime ? Math.floor((Date.now() - lastFetchTime) / 1000) : 0,
      });
    }
    
    return NextResponse.json({
      success: false,
      error: error.message || 'RSS betöltési hiba',
      details: error.toString(),
    }, { status: 500 });
  }
}
