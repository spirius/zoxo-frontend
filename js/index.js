(function() {
    'use strict';

    angular.module('zoxo.init', ['ngRoute', 'ui.router', 'LocalStorageModule', 'ngAnimate', 'ui.bootstrap'])
    .config(['$locationProvider', '$stateProvider', '$urlRouterProvider', function($locationProvider, $stateProvider, $urlRouterProvider) {
        $stateProvider.state('root', {
            abstract: true,
            resolve: {
                user: ['AuthService', function(AuthService) {
                    return AuthService.user()
                }]
            },
            templateUrl: "partial/index.html",
            controller: ['$rootScope', '$timeout', function($rootScope, $timeout) {
                $rootScope.$on("zoxoError", function(event, err) {
                    if ($rootScope.error && $rootScope.error.timeout) {
                        $timeout.cancel($rootScope.error.timeout)
                        $rootScope.error.timeout = null
                    }
                    $rootScope.error = {
                        error: err,
                        show: true,
                        timeout: $timeout(function() {
                            $rootScope.error.show = false;
                        }, 5000),
                    }
                })

                $rootScope.$on("zoxoMsg", function(event, msg) {
                    if ($rootScope.error && $rootScope.error.timeout) {
                        $timeout.cancel($rootScope.error.timeout)
                        $rootScope.error.timeout = null
                    }
                    $rootScope.error = {
                        text: msg,
                        show: true,
                        timeout: $timeout(function() {
                            $rootScope.error.show = false;
                        }, 5000),
                    }
                })
            }]
        }).state('root.index', {
            url: '/',
            templateUrl: "partial/login.html",
            controller: 'LoginController'
        }).state('root.game', {
            abstract: true,
            templateUrl: "partial/game-index.html",
            resolve: {
                checkUser: ['user', '$state', '$rootScope', function(user, $state, $rootScope) {
                    $rootScope.user = user
                    if (!user) {
                        return $state.go("root.index")
                    }
                }]
            },
            controller: ['$scope', '$state',  'API', '$window', function($scope, $state, API, $window) {
                $scope.logout = function() {
                    API.setToken(null);
                    $state.go("root.index", {}, {reload: true}).then(function() {
                        $window.location.reload();
                    })
                }
            }]
        }).state('root.game.list', {
            url: '/list',
            templateUrl: "partial/game-list.html",
            resolve: {
                gameList: ['GameService', 'AuthService', '$q', function(GameService, AuthService, $q) {
                    return GameService.list();
                }]
            },
            controller: 'GameListController'
        }).state('root.game.board', {
            url: '/board/:gameId',
            templateUrl: "partial/game-board.html",
            resolve: {
                game: ['$stateParams', 'GameService', function($stateParams, GameService) {
                    return GameService.get($stateParams.gameId)
                }]
            },
            controller: 'GameBoardController',
        }).state('root.game.join', {
            url: '/join/:gameId',
            resolve: {
                game: ['$stateParams', 'GameService', function($stateParams, GameService) {
                    return GameService.get($stateParams.gameId)
                }]
            },
            controller: ['game', 'user', '$state', 'GameService', function(game, user, $state, GameService) {
                if (game.PlayerO != "-" || game.PlayerX == user.Id) {
                    return $state.go("root.game.list")
                }

                GameService.join(game.Id).catch(function() {
                    return $state.go("root.game.list")
                }).then(function() {
                    return $state.go("root.game.board", {gameId: game.Id})
                })
            }]
        })

        $urlRouterProvider.otherwise('/');
    }])
    .run([function() {
    }])

    angular.element(window).on("load", function() {
        angular.bootstrap(document, ['zoxo.init', 'zoxo']);
    });

})();
