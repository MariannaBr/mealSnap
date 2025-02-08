const { onDocumentCreated } = require("firebase-functions/v2/firestore"); // Firestore v2
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

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
