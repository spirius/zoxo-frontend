(function() {
    'use strict';

    angular.module('zoxo', ['zoxo.init'])
    .config(['localStorageServiceProvider', function(localStorageServiceProvider) {
         localStorageServiceProvider
            .setPrefix('zoxo')
            .setStorageType('localStorage')
            .setNotify(false, false);
    }])
    .service('API', ["$q", "$http", '$state', 'localStorageService', '$rootScope', function($q, $http, $state, localStorageService, $rootScope) {

        var self = this;

        this.conf = {}

        this.base = "./"

        var responseHandler = function(p, noRedirect) {
            return p.then(function(res) {
                if (res && (res.status == 401 || res.status == 403) && !noRedirect) {
                    return $state.go("root.index");
                }

                if (!res || !res.data || !res.data.ok) {
                    return $q.reject({status: 500, error: "Unexpected error"})
                } else if (res.data.error) {
                    return $q.reject({status: res.status, error: res.data.error})
                }
                return $q.resolve(res.data.data);
            }, angular.bind(null, $q.reject)).catch(function(err) {
                var msg = null;

                if (err.data && err.data.error) {
                    msg = err.data.error
                } else if (err.status) {
                    msg = err.status + " " + (err.statusText || "")
                }

                $rootScope.$broadcast("zoxoError", msg || JSON.stringify(err))
                return $q.reject(err)
            })
        }

        this.get = function(url, params, noRedirect) {
            var c = {}
            params = params || {}
            angular.copy(self.conf, c)
            c.params = params
            return responseHandler($http.get(self.base + url, c), noRedirect)
        }

        this.post = function(url, data, noRedirect) {
            return responseHandler($http.post(self.base + url, data, self.conf), noRedirect)
        }

        this.setToken = function(token) {
            this.conf.headers = this.conf.headers || {};
            this.conf.headers["Auth"] = token;

            localStorageService.set("token", token);
        }

        var t = localStorageService.get("token")

        if (t) {
            this.setToken(t);
        }

        return this;
    }])
    .service('AuthService', ['API', '$q', function(API, $q) {

        var users = {};

        this.user = function(userId) {
            var params = {}

            if (userId) {
                params.UserId = userId;
            }

            if (!userId && users.self) {
                return $q.resolve(users.self)
            } else if (users[userId]) {
                return $q.resolve(users[userId])
            }

            return API.get("auth/user", params, true).then(function(res) {
                if (!userId) {
                    users.self = res;
                } else {
                    users[userId] = res;
                }
                return $q.resolve(res);
            }).catch(function(err) {
                if (err.status == 401 || err.status == 403) {
                    return $q.resolve(null);
                } else {
                    return $q.reject(err);
                }
            })
        }

        this.login = function(email, password) {
            return API.post("auth/login", {email: email, password: password}, true).then(function(res) {
                API.setToken(res.token)
                delete(users.self)
                return true;
            })
        }

        this.register = function(email, password, name) {
            return API.post("auth/register", {email: email, password: password, name: name})
        }

        return this;
    }])
    .service('GameService', ['API', 'AuthService', '$q', function(API, AuthService, $q) {
        this.list = function() {
            var d = $q.defer()
            var promises = [];

            API.get('game').then(function(data) {
                for (var i in data) {
                    var up = AuthService.user(data[i].PlayerX).then(angular.bind(null, function(game, u) {
                        game.Users = game.Users || {}
                        game.Users.X = u
                    }, data[i]))

                    promises.push(up);
                }
                $q.all(promises).catch(angular.bind(null, d.reject)).then(angular.bind(null, d.resolve, data));
            }, angular.bind(null, d.reject))

            return d.promise;
        }

        function prepareGame(game) {
            var promises = [];
            promises.push(AuthService.user(game.PlayerX).then(function(userX) {
                game.Users = game.Users || {}
                game.Users.X = userX
            }))

            if (game.PlayerO && game.PlayerO.length > 1) {
                promises.push(AuthService.user(game.PlayerO).then(function(userO) {
                    game.Users = game.Users || {}
                    game.Users.O = userO
                }))

                var boardList = game.Board.split("");
                var counter = {x:0, o:0, "-": 0}
                game.PlayBoard = {}
                for (var i in boardList) {
                    var ii = (i - i%3) / 3
                    var jj = i % 3
                    game.PlayBoard[ii] = game.PlayBoard[ii] || {}
                    game.PlayBoard[ii][jj] = {d: boardList[i], active: boardList[i] == "-"}

                    counter[boardList[i]]++
                }

                game.Next = counter.x <= counter.o ? "x" : "o"
            } else {
                game.Idle = true
            }

            return $q.all(promises).then(angular.bind(game, function() {return this}));
        }

        this.get = function(gameId) {
            return API.get('game/' + gameId).then(prepareGame)
        }

        this.create = function() {
            return API.post('game')
        }

        this.join = function(gameId) {
            return API.post('game/join', {GameId: gameId})
        }

        this.cross = function(gameId, x, y) {
            return API.post('game/cross', {GameId: gameId, CX: x, CY: y}).then(prepareGame)
        }
    }])
    .controller('LoginController', ['$state', '$scope', 'AuthService', '$rootScope', '$uibModal', 'user', function($state, $scope, AuthService, $rootScope, $uibModal, user) {
        if (user) {
            return $state.go("root.game.list");
        }
        $scope.login = function() {
            AuthService.login($scope.email, $scope.password).then(function(res) {
                return $state.go("root.game.list", {}, {reload: true})
            })
        }

        $scope.register = function() {
            var m = $uibModal.open({
                templateUrl: "partial/reg.html",
                controller: ['$scope', function($scope) {
                    $scope.register = function() {
                        AuthService.register($scope.email, $scope.password, $scope.name).then(function(res) {
                            $scope.$close(res)
                        }, function(err) {
                            $scope.$dismiss(err)
                        })
                    }
                }]
            });

            m.result.then(function(a) {
                $rootScope.$broadcast("zoxoMsg", "Registration completed, please login!")
            })
        }
    }])

    .controller('GameListController', ['$state', '$scope', 'GameService', 'user', 'gameList', '$interval', '$rootScope',
    function($state, $scope, GameService, user, gameList, $interval, $rootScope) {
        $scope.gameList = gameList;

        $scope.$on("$destroy", angular.bind(null, $interval.cancel, $interval(function() {
            GameService.list().then(function(data) {
                $scope.gameList = data
            })
        }, 2000)))

        $scope.create = function() {
            GameService.create().then(function(data) {
                $state.go("root.game.board", {gameId: data.Id})
            })
        }

        $scope.join = function(game) {
            if (game.PlayerX == user.Id) {
                return $rootScope.$broadcast("zoxoError", "Cannot join to own game")
            }

            return GameService.join(game.Id).then(function(res) {
                return $state.go("root.game.board", {gameId: res.Id})
            })
        }
    }])

    .controller('GameBoardController', ['$scope', '$state', '$interval', 'game', 'user', 'GameService', function($scope, $state, $interval, game, user, GameService) {
        var updateGame = function(game) {
            if (game.Idle) {
                $scope.game = game;
                return;
            }

            if (game.WinnerPattern) {
                for (var i in game.WinnerPattern) {
                    var ii = (i - i % 3) / 3;
                    var jj = i % 3;

                    var p = game.WinnerPattern[i]

                    if (p == game.PlayBoard[ii][jj].d) {
                        game.PlayBoard[ii][jj].mark = true;
                    }
                }

                game.Winner = game.WinnerId == game.Users.X.Id ? game.Users.X : game.Users.O
            }

            game.NextSelf = (game.Next == "x" && game.PlayerX == user.Id) || (game.Next == "o" && game.PlayerO == user.Id)
            game.MySign = game.PlayerX == user.Id ? "x" : "o"

            $scope.game = game;
        }

        updateGame(game);

        $scope.cross = function(cell, row, col) {
            if (cell.d != '-' || !$scope.game.NextSelf) {
                return;
            }

            GameService.cross($scope.game.Id, col, row).then(updateGame)
        }

        $scope.$state = $state;

        $scope.$on("$destroy", angular.bind(null, $interval.cancel, $interval(function() {
            GameService.get($scope.game.Id).then(updateGame)
        }, 2000)))
    }])

})()
