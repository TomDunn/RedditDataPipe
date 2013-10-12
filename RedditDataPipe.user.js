// ==UserScript==
// @name        RedditDataPipe
// @namespace   tomdunn.net
// @include     http://reddit.com/*
// @include     http://www.reddit.com/*
// @include     http://tomdunn.net/
// @version     1
// @require     http://code.jquery.com/jquery-2.0.3.min.js
// @require     http://underscorejs.org/underscore-min.js
// ==/UserScript==

(function() {
    var console = unsafeWindow.console;
    var userKey = 'RedditDataPipe_UserKey';
    var dockHost = 'tomdunn.net';

    var getUserHash = function() {
        return JSON.parse(GM_getValue(userKey, '{}'));
    };
    
    var setUserHash = function(obj) {
        GM_setValue(userKey, JSON.stringify(obj));
    };
    
    var idKey = 'RedditDataPipe_idKey';
    
    var getId = function() {
        return GM_getValue(idKey, null);
    };
    
    var saveId = function(id) {
        GM_setValue(idKey, id);
    };
    
    var fetchId = function() {
        if (getId()) {
            return;
        }
        
        jsonReq({
            url: 'http://localhost:5000/get_id',
            success: function(data, resp) {
                saveId(data.id);
            }
        });
    };
    
    var findUsers = function() {
        users = getUserHash();
        
        $('.author').each(function() {
            var author = $(this).text();
            
            if (!users[author]) {
                users[author] = 1;
            }
        });
        
        setUserHash(users);
    };

    var findLinks = function() {
        var links = [];

        console.log("here");

        $('div.thing.link').each(function() {
            this = $(this);

            console.log("there");

            var thumb       = '';
            var thumbImage  = this.find('a.thumbnail img');
            var thumbSelf   = this.find('a.thumbnail.self');

            if (thumbImage.length) {
                thumb = thumbImage.attr('src');
            }

            if (thumbSelf.length) {
                thumb = 'self';
            }

            var ups     = Number(this.attr('data-ups'));
            var downs   = Number(this.attr('data-downs'));

            console.log(this.attr('data-fullname'));

            links.push({
                reddit_id:      this.attr('data-fullname'),
                domain:         this.find('span.domain a').text(),
                url:            this.find('p.title a.title').attr('href'),
                permalink:      this.find('a.commments').attr('href'),
                title:          this.find('p.title a.title').text(),
                thumbnail:      thumb,
                authorname:     this.find('a.author').text(),
                sub_name:       this.find('a.subreddit').text(),
                created:        this.find('time:first-child').attr('datetime'),
                score:          ups - downs,
                downs:          downs,
                ups:            ups,
                is_self:        thumb == 'self',
                over_18:        this.find('nsfw-stamp').length > 0
            });
        });

        return links;
    };
    
    var jsonReq = function(options) {
        var method = options.method || 'GET';
        var successCb = options.success || $.noop;
        var errorCb = options.error || $.noop;
        options.data = options.data || {};
        options.data.id = getId();
        
        return GM_xmlhttpRequest({
            method: method,
            url: options.url,
            data: JSON.stringify(options.data),
            headers: {
                'Content-Type': 'application/json',
                'Accept':       'application/json',
                'User-Agent':   'RedditDataPipe app version 1.0'
            },
            onload: function(response) {
                console.log(response);
                data = JSON.parse(response.responseText);
                
                if (response.status !== 200) {
                    errorCb(data, response);
                }
                
                successCb(data, response);
            },
            onerror: function(response) {
                console.log('fuck');
                errorCb(JSON.parse(response.responseText), response);
            }
        });
    };
    
    var postUsers = function() {
        users = getUserHash();
        newUsers = _.filter(_.keys(users), function(user) {
            return users[user] === 1;
        });
        
        console.log(newUsers.length);
        
        if (newUsers.length === 0) {
            return;
        }
        
        data = {users: newUsers};
        
        jsonReq({
            method: 'POST',
            url:    'http://localhost:5000/new_users',
            data:   data,
            success: function(data, resp) {
                console.log(data);
                
                _.each(newUsers, function(u) {
                    users[u] = 2;
                });
                
                setUserHash(users);
                console.log(getUserHash());
            },
            error:  function(data, resp) {
                console.log(data);
            }
        });
        
    };
    
    var getUsers = function(pendingUsers, doneUsers, done) {
        var tick = function() {
            var user = pendingUsers.pop();
            
            if (user === undefined) {
                clearInterval(int);
                return done(doneUsers);
            }
            
            console.log(user);
            jsonReq({
                url: 'http://reddit.com/user/' + user + '/about.json',
                success: function(data, resp) {
                    doneUsers.push(data.data);
                },
                error: function(data, resp) {
                    console.log("ERROR");
                    console.log(data);
                    
                    if (400 <= data.status < 500) {
                        doneUsers.push({name: user, error: true});
                    } else {
                        pendingUsers.push(user);
                    }
                }
            });
        }
        
        var int = setInterval(tick, 2500);
    };
    
    var makeBatch = function(cb) {
        jsonReq({
            method: 'POST',
            url: 'http://localhost:5000/make_batch',
            success: function(data, resp) {
                console.log('suc');
                cb(data.users);
            },
            error: function(data, resp) {
                console.log('error');
            }
        });
    };
    
    var putBatch = function(users, cb) {
        jsonReq({
            method: 'PUT',
            url: 'http://localhost:5000/put_batch',
            data: {users: users},
            success: function(data, resp) {
                console.log(data);
            },
            error: function(data, resp) {
                console.log(data);
            }
        });
    };
    
    var removeUserHash = function() {
        setUserHash({});
    };
    
    var updateUsers = function() {
        makeBatch(function(pendingUsers) {
            getUsers(pendingUsers, [], function(doneUsers) {
                console.log(doneUsers);
                putBatch(doneUsers);
                setTimeout(updateUsers, 5000);
            });
        });
    };

    fetchId();
    
    if (window.location.host === dockHost) {
        setTimeout(updateUsers, 3000);
        return;
    }
    
    removeUserHash();
    //findUsers();
    console.log('test');
    console.log(findLinks());
    //setTimeout(postUsers, 2000);
    
})();
