const { onDocumentCreated } = require("firebase-functions/v2/firestore"); // Firestore v2
const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();
const db = admin.firestore();

// Update streak on new post
exports.updateStreakOnPost = onDocumentCreated(
  "userPosts/{postId}",
  async (event) => {
    console.log("New post detected!", event.params.postId);
    const newPost = event.data.data();
    const userRef = newPost?.postUser;
    const userId = newPost?.postUser.id;
    console.log("user id", userId);

    if (!userId) {
      console.error("Error: userId is undefined or empty");
      return;
    }

    const postsSnapshot = await db
      .collection("userPosts")
      .where("postUser", "==", userRef)
      .orderBy("timePosted", "desc")
      .get();

    let streak = 0;
    let lastDate = null;

    postsSnapshot.forEach((doc) => {
      const postDate = doc.data().timePosted.toDate();
      const postDay = postDate.toISOString().split("T")[0]; // YYYY-MM-DD

      if (!lastDate) {
        lastDate = postDay;
        streak = 1;
      } else {
        const prevDay = new Date(lastDate);
        prevDay.setDate(prevDay.getDate() - 1);

        if (postDay === lastDate) {
          return;
        } else if (postDay === prevDay.toISOString().split("T")[0]) {
          streak += 1;
        } else {
          return;
        }
      }

      lastDate = postDay;
    });

    console.log("Updating streak for user:", userId);

    await db.collection("users").doc(userId).update({ streak: streak });
  }
);

// Daily streak check

const everyDay = "every day 00:00";
const every5Minutes = "every 5 minutes";

exports.dailyStreakCheck = onSchedule(everyDay, async (event) => {
  console.log("Running daily streak check...");

  const usersSnapshot = await db.collection("users").get();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = yesterday.toISOString().split("T")[0]; // Format YYYY-MM-DD

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    console.log(`Checking streak for user: ${userId}`);

    // Find the most recent post by the user
    const postsSnapshot = await db
      .collection("userPosts")
      .where("postUser", "==", db.doc(`users/${userId}`))
      .orderBy("timePosted", "desc")
      .limit(1)
      .get();

    if (!postsSnapshot.empty) {
      const lastPost = postsSnapshot.docs[0].data();
      const lastPostDate = lastPost.timePosted
        .toDate()
        .toISOString()
        .split("T")[0]; // YYYY-MM-DD

      console.log(`Last post for user ${userId} was on: ${lastPostDate}`);

      if (lastPostDate === yesterdayString) {
        console.log(`✅ User ${userId} posted yesterday. Streak continues.`);
      } else {
        console.log(
          `❌ User ${userId} did NOT post yesterday. Resetting streak.`
        );
        await db.collection("users").doc(userId).update({ streak: 0 });
      }
    } else {
      console.log(`❌ User ${userId} has never posted. Streak remains 0.`);
    }
  }
  console.log("Daily streak check complete.");
});
