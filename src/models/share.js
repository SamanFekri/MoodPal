const mongoose = require('mongoose');

const shareSchema = new mongoose.Schema({
  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  followed: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

shareSchema.statics.createShare = async function (follower, followed) {
  // check if the share already exists just enable it
  let share = await this.findOne({ follower, followed });
  if (share) {
    share.disabled = false;
    await share.save();
    return share;
  } else {
    share = await this.create({ follower, followed });
    return share;
  }
};

shareSchema.statics.getShare = async function (follower, followed) {
  const share = await this.findOne({ follower, followed });
  return share;
};

shareSchema.statics.disableShare = async function (follower, followed) {
  const share = await this.findOne({ follower, followed });
  if (share) {
    share.disabled = true;
    await share.save();
  }
};


shareSchema.statics.enableShare = async function (follower, followed) {
  const share = await this.findOne({ follower, followed });
  if (share) {
    share.disabled = false;
    await share.save();
  }
};

shareSchema.statics.getFollowers = async function (followed) {
  const shares = await this.find({ followed }).populate('follower');
  return shares;
};

shareSchema.statics.getFollowings = async function (follower) {
  const shares = await this.find({ follower }).populate('followed');
  return shares;
};

module.exports = mongoose.model('Share', shareSchema);