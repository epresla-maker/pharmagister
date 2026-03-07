/**
 * Migration script: Move comments from nested array in post document
 * to subcollection communityPosts/{postId}/comments/{commentId}
 * 
 * Run: node migrate-comments-to-subcollection.js
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  });
}

const db = admin.firestore();

async function migrateComments() {
  console.log('Starting comment migration...\n');

  const postsSnapshot = await db.collection('communityPosts').get();
  let totalPosts = 0;
  let totalComments = 0;
  let migratedPosts = 0;

  for (const postDoc of postsSnapshot.docs) {
    const postData = postDoc.data();
    const comments = postData.comments;

    if (!comments || comments.length === 0) {
      continue;
    }

    totalPosts++;
    console.log(`\nMigrating post ${postDoc.id} (${comments.length} root comments)...`);

    const commentsRef = db.collection('communityPosts').doc(postDoc.id).collection('comments');
    let postCommentCount = 0;

    // Recursive function to migrate a comment and its replies
    async function migrateComment(comment, parentCommentId) {
      const commentData = {
        parentCommentId: parentCommentId,
        text: comment.text || '',
        userId: comment.userId || 'unknown',
        isAnonymous: comment.isAnonymous !== undefined ? comment.isAnonymous : true,
        authorData: comment.authorData || null,
        createdAt: comment.createdAt ? new Date(comment.createdAt) : new Date(),
        replyCount: comment.replies?.length || 0,
      };

      // Use the old comment ID as the Firestore document ID
      await commentsRef.doc(comment.id).set(commentData);
      postCommentCount++;
      totalComments++;

      // Migrate replies recursively
      if (comment.replies && comment.replies.length > 0) {
        for (const reply of comment.replies) {
          await migrateComment(reply, comment.id);
        }
      }
    }

    // Migrate all root comments
    for (const comment of comments) {
      await migrateComment(comment, null);
    }

    // Update post document: set commentCount and mark as migrated
    await db.collection('communityPosts').doc(postDoc.id).update({
      commentCount: postCommentCount,
      commentsMigrated: true,
      // Keep old comments array as backup (can be removed later)
      // comments: admin.firestore.FieldValue.delete(),
    });

    migratedPosts++;
    console.log(`  ✓ Migrated ${postCommentCount} comments (including replies)`);
  }

  console.log('\n========================================');
  console.log(`Migration complete!`);
  console.log(`Posts with comments: ${totalPosts}`);
  console.log(`Posts migrated: ${migratedPosts}`);
  console.log(`Total comments migrated: ${totalComments}`);
  console.log('========================================\n');

  // Optional: verify migration
  console.log('Verifying migration...');
  for (const postDoc of postsSnapshot.docs) {
    const postData = postDoc.data();
    if (!postData.comments || postData.comments.length === 0) continue;

    const subcollectionSnapshot = await db.collection('communityPosts').doc(postDoc.id).collection('comments').get();
    const oldCount = countAllComments(postData.comments);
    const newCount = subcollectionSnapshot.size;

    if (oldCount !== newCount) {
      console.log(`  ⚠ Post ${postDoc.id}: old=${oldCount}, new=${newCount} - MISMATCH!`);
    } else {
      console.log(`  ✓ Post ${postDoc.id}: ${newCount} comments verified`);
    }
  }
}

function countAllComments(comments) {
  let count = comments?.length || 0;
  comments?.forEach(c => {
    count += countAllComments(c.replies);
  });
  return count;
}

migrateComments().catch(console.error);
