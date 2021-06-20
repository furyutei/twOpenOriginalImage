( function ( w, d ) {

'use strict';

w.chrome = ( ( typeof browser != 'undefined' ) && browser.runtime ) ? browser : chrome;


var DEBUG = false,
    
    SCRIPT_NAME = 'twOpenOriginalImage',
    
    CONTEXT_MENU_INITIALIZED = false,
    CONTEXT_MENU_IS_VISIBLE = true,
    CONTEXT_MENU_IS_SUSPENDED = false,
    SUPPRESS_FILENAME_SUFFIX = false,
    
    DOWNLOAD_MENU_ID = 'download_image',
    
    DOWNLOAD_TAB_MAP_NAME = SCRIPT_NAME + '-download_tab_map',
    
    CONTENT_TAB_INFOS = {};


if ( typeof console.log.apply == 'undefined' ) {
    // MS-Edge 拡張機能では console.log.apply 等が undefined
    // → apply できるようにパッチをあてる
    // ※参考：[javascript - console.log.apply not working in IE9 - Stack Overflow](https://stackoverflow.com/questions/5538972/console-log-apply-not-working-in-ie9)
    
    [ 'log', 'info', 'warn', 'error', 'assert', 'dir', 'clear', 'profile', 'profileEnd' ].forEach( function ( method ) {
        console[ method ] = this.bind( console[ method ], console );
    }, Function.prototype.call );
    
    console.log( 'note: console.log.apply is undefined => patched' );
}


function to_array( array_like_object ) {
    return Array.prototype.slice.call( array_like_object );
} // end of to_array()


function log_debug() {
    if ( ! DEBUG ) {
        return;
    }
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.log.apply( console, arg_list.concat( to_array( arguments ) ) );
} // end of log_debug()


function log_error() {
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.error.apply( console, arg_list.concat( to_array( arguments ) ) );
} // end of log_error()


w.log_debug = log_debug;
w.log_error = log_error;

var is_firefox = ( function () {
    var flag = ( 0 <= w.navigator.userAgent.toLowerCase().indexOf( 'firefox' ) );
    
    return function () {
        return flag;
    };
} )(); // end of is_firefox()


var is_edge = ( function () {
    var flag = ( 0 <= w.navigator.userAgent.toLowerCase().indexOf( 'edge' ) );
    
    return function () {
        return flag;
    };
} )(); // end of is_edge()


var is_vivaldi = ( function () {
    var flag = ( 0 <= w.navigator.userAgent.toLowerCase().indexOf( 'vivaldi' ) );
    
    return function () {
        return flag;
    };
} )(); // end of is_vivaldi()


function is_twitter_page( url ) {
    if ( ! url ) {
        return false;
    }
    
    return /https?:\/\/(((mobile|tweetdeck)\.)?twitter\.com|pbs\.twimg\.com)\//.test( url );
} // end of is_twitter_page()


function get_bool( value ) {
    if ( value === undefined ) {
        return null;
    }
    if ( ( value === '0' ) || ( value === 0 ) || ( value === false ) || ( value === 'false' ) ) {
        return false;
    }
    if ( ( value === '1' ) || ( value === 1 ) || ( value === true ) || ( value === 'true' ) ) {
        return true;
    }
    return null;
} // end of get_bool()


function update_context_menu_flags() {
    var is_valid = ( get_bool( localStorage[ 'DOWNLOAD_HELPER_SCRIPT_IS_VALID' ] ) !== false ) ? true : false,
        operation = ( get_bool( localStorage[ 'OPERATION' ] ) !== false ) ? true : false;
    
    CONTEXT_MENU_IS_VISIBLE = is_valid;
    CONTEXT_MENU_IS_SUSPENDED = ! operation;
    
    log_debug( 'CONTEXT_MENU_IS_VISIBLE:', CONTEXT_MENU_IS_VISIBLE, 'CONTEXT_MENU_IS_SUSPENDED:', CONTEXT_MENU_IS_SUSPENDED );
    
    SUPPRESS_FILENAME_SUFFIX = ( get_bool( localStorage[ 'SUPPRESS_FILENAME_SUFFIX' ] ) === true ) ? true : false;
} // end of update_context_menu_flags()


function get_url_info( url ) {
    var url_parts = url.split( '?' ),
        query_map = {},
        url_info = { base_url : url_parts[ 0 ], query_map : query_map };
    
    if ( url_parts.length < 2 ) {
        return url_info;
    }
    
    url_parts[ 1 ].split( '&' ).forEach( function ( query_part ) {
        var parts = query_part.split( '=' );
        
        query_map[ parts[ 0 ] ] = ( parts.length < 2 ) ? '' : parts[ 1 ];
    } );
    
    return url_info;
} // end of get_url_info()


function normalize_img_url( source_url ) {
    var url_info = get_url_info( source_url ),
        base_url = url_info.base_url,
        format = url_info.query_map.format,
        name = url_info.query_map.name;
    
    if ( ! format ) {
        return source_url;
    }
    
    return base_url + '.' + format + ( ( name ) ? ':' + name : '' );
} // end of normalize_img_url()


function get_formatted_img_url( normalized_img_url ) {
    var formatted_img_url;
    
    if ( normalized_img_url.match( /^(.+)\.([^.:]+):?((?:[^:]+)?)$/ ) ) {
        formatted_img_url = RegExp.$1 + '?format=' + RegExp.$2 + ( ( RegExp.$3 ) ? '&name=' + RegExp.$3 : '' );
    }
    else {
        formatted_img_url = normalized_img_url;
    }
    
    log_debug( 'formatted_img_url=', formatted_img_url, normalized_img_url );
    
    return formatted_img_url;
} // end of get_formatted_img_url()


function get_filename_from_image_url( img_url ) {
    if ( ! /:\w*$/.test( img_url ) ) {
        return null;
    }
    
    if ( ! img_url.match( /^.+\/([^\/.]+)\.(\w+):(\w+)$/ ) ) {
        return img_url;
    }
    
    var base = RegExp.$1,
        ext = RegExp.$2,
        suffix = RegExp.$3;
    
    if ( SUPPRESS_FILENAME_SUFFIX ) {
        return base + '.' + ext;
    }
    else {
        return base + '-' + suffix + '.' + ext;
    }
} // end of get_filename_from_image_url()


function get_extension_from_image_url( img_url ) {
    if ( ! /:\w*$/.test( img_url ) ) {
        return null;
    }
    
    if ( ! img_url.match( /^.+\/([^\/.]+)\.(\w+):(\w+)$/ ) ) {
        return null;
    }
    
    var ext = RegExp.$2;
    
    return ext;
} // end of get_extension_from_image_url()


function set_values( name_value_map, callback ) {
    return new Promise( function ( resolve, reject ) {
        chrome.storage.local.set( name_value_map, function () {
            if ( typeof callback == 'function' ) {
                callback();
            }
            resolve();
        } );
    } );
} // end of set_values()


function get_values( name_list, callback ) {
    return new Promise( function ( resolve, reject ) {
        if ( typeof name_list == 'string' ) {
            name_list = [ name_list ];
        }
        
        chrome.storage.local.get( name_list, function ( name_value_map ) {
            name_list.forEach( function ( name ) {
                if ( name_value_map[ name ] === undefined ) {
                    name_value_map[ name ] = null;
                }
            } );
            
            if ( typeof callback == 'function' ) {
                callback( name_value_map );
            }
            resolve( name_value_map );
        } );
    } );
} // end of get_values()

/*
//function reload_tabs() {
//    chrome.tabs.query( {
//        url : '*://*.twitter.com/*' // TODO: url で query() を呼ぶためには tabs permission が必要になる
//    }, function ( result ) {
//        result.forEach( function ( tab ) {
//            if ( ! tab.url.match( /^https?:\/\/(?:(?:tweetdeck|mobile)\.)?twitter\.com\// ) ) {
//                return;
//            }
//            chrome.tabs.reload( tab.id );
//        } );
//    });
//} // end of reload_tabs()
*/

var reload_tabs = ( () => {
    var reg_host = /([^.]+\.)?twitter\.com/,
        
        reload_tab = ( tab_info ) => {
            log_debug( 'reload_tab():', tab_info );
            var tab_id = tab_info.tab_id;
            
            chrome.tabs.sendMessage( tab_id, {
                type : 'RELOAD_REQUEST',
            }, {
            }, ( response ) => {
                log_debug( 'response', response );
                if ( chrome.runtime.lastError || ( ! response ) ) {
                    // タブが存在しないか、応答が無ければ chrome.runtime.lastError 発生→タブ情報を削除
                    // ※chrome.runtime.lastErrorをチェックしないときは Console に "Unchecked runtime.lastError: No tab with id: xxxx." 表示
                    delete CONTENT_TAB_INFOS[ tab_id ];
                    log_debug( 'tab or content_script does not exist: tab_id=', tab_id, '=> removed:', tab_info, '=> remained:', CONTENT_TAB_INFOS );
                }
            } );
        };
    
    return () => {
        log_debug( 'reload_tabs():', CONTENT_TAB_INFOS );
        Object.values( CONTENT_TAB_INFOS ).forEach( ( tab_info ) => {
            log_debug( tab_info );
            
            try {
                if ( ! reg_host.test( new URL( tab_info.url ).host ) ) {
                    return;
                }
            }
            catch ( error ) {
                return;
            }
            
            reload_tab( tab_info );
        } );
    };
} )();

w.reload_tabs = reload_tabs;


function download_image( info, tab ) {
    var img_url = info.srcUrl,
        frame_id = info.frameId,
        page_url = info.frameUrl || info.pageUrl;
    
    img_url = normalize_img_url( img_url );
    
    var img_url_orig = img_url.replace( /:\w*$/, '' ) + ':orig',
        // filename = get_filename_from_image_url( img_url_orig );
        extension = get_extension_from_image_url( img_url_orig ),
        filename = info.linkUrl.replace( /^https?:\/\/(?:mobile\.)?twitter\.com\/([^\/]+)\/status(?:es)?\/(\d+)\/photo\/(\d+).*$/, '$1-$2-img$3' ),
        filename = filename + '.' + extension;
    
    img_url_orig = get_formatted_img_url( img_url_orig );
    
    log_debug( '*** download_image():', img_url, img_url_orig, filename );
    
    var do_download = function () {
            // ある時点から、ファイル名が変わらなくなった(0.1.7.1000で2017年7月末頃発生・クロスドメインとみなされている模様)
            //var download_link = d.createElement( 'a' );
            //download_link.href = img_url_orig;
            //download_link.download = filename;
            //d.documentElement.appendChild( download_link );
            //download_link.click();
            
            // 覚書：「Download with Free Download Manager (FDM)」等を使っていると、ここで指定したファイル名が無視される
            // → DeterminingFilename イベントを監視し、そこでファイル名を指定するように修正(0.1.7.1701)
            // → イベント監視だと、他の拡張機能との競合が発生するため、別の方法を検討(0.1.7.1702)
            //chrome.downloads.download( {
            //    url : img_url_orig
            //,   filename : filename
            //} );
            
            if ( is_vivaldi() ) {
                // TODO: Vivaldi 1.15.1147.36 (Stable channel) (32-bit)・V8 6.5.254.41 での動作がおかしい（仕様変更？）
                // - a[download]作成→click() だと、ページ遷移になってしまう
                // - chrome.downloads.download() でファイル名が変更できない
                chrome.downloads.download( {
                    url : img_url_orig,
                    filename : filename
                } );
                return;
            }
            
            var xhr = new XMLHttpRequest();
            
            xhr.open( 'GET', img_url_orig, true );
            xhr.responseType = 'blob';
            xhr.onload = function () {
                if ( xhr.readyState != 4 ) {
                    return;
                }
                
                var blob = xhr.response,
                    blob_url = URL.createObjectURL( blob );
                
                
                // - Firefox WebExtension の場合、XMLHttpRequest / fetch() の結果得た Blob を Blob URL に変換した際、PNG がうまくダウンロードできない
                //   ※おそらく「次のファイルを開こうとしています…このファイルをどのように処理するか選んでください」のダイアログが background からだと呼び出せないのだと思われる
                // - Chrome で、background 内での a[download] によるダウンロードがうまく行かなくなった(バージョン: 65.0.3325.162)
                // → 新規にタブを開いてダウンロード処理を行う
                chrome.tabs.create( {
                    url : 'html/download.html?url=' + encodeURIComponent( blob_url ) + '&filename=' + encodeURIComponent( filename ),
                    active : false
                }, function ( tab ) {
                    get_values( [ DOWNLOAD_TAB_MAP_NAME ] )
                    .then( function ( name_value_map ) {
                        var download_tab_map = name_value_map[ DOWNLOAD_TAB_MAP_NAME ];
                        
                        if ( ! download_tab_map ) {
                            download_tab_map = {};
                        }
                        
                        download_tab_map[ blob_url ] = tab.id;
                        
                        set_values( {
                            [ DOWNLOAD_TAB_MAP_NAME ] : download_tab_map
                        } );
                    } );
                } );
                return;
                
                /*
                //var download_link = d.createElement( 'a' );
                //
                //download_link.href = blob_url;
                //download_link.download = filename;
                //
                //d.documentElement.appendChild( download_link );
                //
                //download_link.click();
                //// TODO: MS-Edge 拡張機能の場合、ダウンロードされない
                //// TODO: Firefox WebExtension の場合、XMLHttpRequest / fetch() の結果得た Blob を Blob URL に変換した際、PNG がうまくダウンロードできない
                //
                //download_link.parentNode.removeChild( download_link );
                */
            };
            xhr.onerror = function () {
                chrome.downloads.download( {
                    url : img_url_orig
                ,   filename : filename
                } );
            };
            xhr.send();
        };
    
    
    log_debug( '*** download_image(): info, tab', info, tab );
    if ( tab && tab.id && is_twitter_page( page_url ) ) {
        var message = {
                type : 'DOWNLOAD_IMAGE_REQUEST',
                img_url : img_url,
                img_url_orig : img_url_orig,
                filename : filename
            },
            options = {
                frameId : frame_id
            };
        
        try {
            chrome.tabs.sendMessage( tab.id, message, options, function ( response ) {
                log_debug( '*** download_image(): response', response );
                
                if ( ( ! response ) || ( response.result != 'OK' ) ) {
                    do_download();
                }
            } );
        }
        catch ( error ) {
            do_download();
        }
    }
    else {
        do_download();
    }
} // end of download_image()


function on_determining_filename( downloadItem, suggest ) {
    update_context_menu_flags();
    
    if ( ( ! CONTEXT_MENU_IS_VISIBLE ) || CONTEXT_MENU_IS_SUSPENDED ) {
        return true;
    }
    if ( downloadItem.byExtensionId != chrome.runtime.id ) {
        // 本拡張機能以外から保存した場合は無視
        // ※この判定を無効化すれば、コンテキストメニューから「名前を付けて画像を保存」した場合も、http://～/xxx.jpg:kind → xxx-kind.jpg に変換される
        return true;
    }
    
    var url = downloadItem.finalUrl || downloadItem.url;
    
    if ( ! /^https?:\/\/pbs\.twimg\.com\/media\/[^:]+:\w*$/.test( url ) ) {
        return true;
    }
    
    suggest( {
        filename : get_filename_from_image_url( url )
    } );
    return true;
} // end of on_determining_filename()


function on_changed( downloadDelta ) {
    if ( ! downloadDelta || ! downloadDelta.state ) {
        return;
    }
    
    switch ( downloadDelta.state.current ) {
        case 'complete' : // ダウンロード完了時
            break;
        
        case 'interrupted' : // ダウンロードキャンセル時（downloadDelta.error.current = "USER_CANCELED" ）等
            // ※ Firefox の場合には、ダウンロードキャンセル時にイベントが発生しない
            break;
        
        default :
            return;
    }
    
    chrome.downloads.search({
        id : downloadDelta.id
    }, function ( results ) {
        if ( ! results || results.length <= 0 ) {
            return;
        }
        
        get_values( [ DOWNLOAD_TAB_MAP_NAME ] )
        .then( function ( name_value_map ) {
            var download_tab_map = name_value_map[ DOWNLOAD_TAB_MAP_NAME ];
            
            if ( ! download_tab_map ) {
                return;
            }
            
            results.forEach( function ( download_info ) {
                var tab_id = download_tab_map[ download_info.url ];
                
                if ( ! tab_id ) {
                    return;
                }
                
                delete download_tab_map[ download_info.url ];
                
                try {
                    chrome.tabs.remove( tab_id, function () {
                        log_debug( 'removed: tab_id=', tab_id );
                    } );
                }
                catch ( error ) {
                    log_error( 'remove error: tab_id=', tab_id, error );
                }
            } );
            
            set_values( {
                [ DOWNLOAD_TAB_MAP_NAME ] : download_tab_map
            } );
        } );
        
    } );
} // end of on_changed()


function initialize( eventname ) {
    log_debug( '*** initialize():', eventname );
    
    if ( is_edge() ) {
        // TODO: MS-Edge の拡張機能だと、background スクリプトからのダウンロードが出来ない(?)
        //   参考： [Extensions - Supported APIs - Microsoft Edge Development | Microsoft Docs](https://docs.microsoft.com/en-us/microsoft-edge/extensions/api-support/supported-apis)
        //   | ・Triggering a download via a hidden anchor tag will fail from background scripts. This should be done from an extension page instead.
        //
        // ・browser.downloads API が存在しない(2017/04/11現在のロードマップで、"Under consideration" になっている
        //   [Extensions - Extension API roadmap - Microsoft Edge Development | Microsoft Docs](https://docs.microsoft.com/en-us/microsoft-edge/extensions/api-support/extension-api-roadmap)
        //   | downloads | Used to programmatically initiate, monitor, manipulate, and search for downloads. | Under consideration
        //
        // ・XMLHttpRequest で取得した Blob を URL.createObjectURL() で変換したものを download 属性付 A タグの href にセットしてクリックしてもダウンロードされない
        //
        // ・navigator.msSaveOrOpenBlob() 等も使えない
        //   ※「SCRIPT16386: SCRIPT16386: インターフェイスがサポートされていません」のようなエラーになる
        //
        // ・tabs.create() で新たにタブを開いた場合も、background から開いたときは上記の不具合が継承される模様
        
        chrome.contextMenus.remove( DOWNLOAD_MENU_ID );
        return;
    }
    
    var title = chrome.i18n.getMessage( 'DOWNLOAD_ORIGINAL_IMAGE' );
    
    update_context_menu_flags();
    
    if ( ! CONTEXT_MENU_IS_VISIBLE ) {
        if ( CONTEXT_MENU_INITIALIZED ) {
            chrome.contextMenus.remove( DOWNLOAD_MENU_ID );
            CONTEXT_MENU_INITIALIZED = false;
        }
        
        log_debug( '*** initialize(): remove context menu' );
        return;
    }
    
    if ( CONTEXT_MENU_IS_SUSPENDED ) {
        title += '[' + chrome.i18n.getMessage( 'UNDER_SUSPENSION' ) +']';
    }
    
    if ( CONTEXT_MENU_INITIALIZED ) {
        chrome.contextMenus.update( DOWNLOAD_MENU_ID, {
            title : title
        } );
        
        log_debug( '*** initialize(): rename title to ', title );
        return;
    }
    
    CONTEXT_MENU_INITIALIZED = true;
    
    log_debug( '*** initialize(): completed' );
    
    /*
    // TODO:
    //   ときどき、ブラウザを再起動後等の状態で
    //   Unchecked runtime.lastError while running contextMenus.create: Cannot create item with duplicate id download_image
    //   が発生。
    //   ※ chrome.contextMenus.removeAll() 後であっても発生してしまう。
    //try {
    //    chrome.contextMenus.create( {
    //        type : 'normal'
    //    ,   id : DOWNLOAD_MENU_ID
    //    ,   title : title
    //    ,   contexts : [ 'image' ]
    //    ,   targetUrlPatterns : [ '*://pbs.twimg.com/media/*' ]
    //    } );
    //}
    //catch( error ) {
    //    // TODO: try～catch にも引っかからない模様
    //    // 参考: [Issue 551912 - chromium - Try/Catch not working when trying to create existing menu](https://code.google.com/p/chromium/issues/detail?id=551912)
    //    log_error( error );
    //}
    */
    
    chrome.contextMenus.remove( DOWNLOAD_MENU_ID, () => {
        if ( chrome.runtime.lastError ) {
            log_debug( '*** context menu does not exist ***' );
        }
        else {
            log_debug( '*** removed existing context menu ***' );
        }
        
        chrome.contextMenus.create( {
            type : 'normal'
        ,   id : DOWNLOAD_MENU_ID
        ,   title : title
        ,   contexts : [ 'image' ]
        ,   targetUrlPatterns : [ '*://pbs.twimg.com/media/*' ]
        }, () => {
            log_debug( '*** created context menu ***' );
        } );
    } );
    
} // end of initialize()


var request_tab_sorting = ( () => {
    var sort_index_to_tab_id_map_map = {},
        callback_map = {},
        
        get_tab_index = ( tab_id ) => {
            return new Promise( ( resolve, reject ) => {
                chrome.tabs.get( tab_id, ( tab ) => {
                    resolve( tab.index );
                } );
            } );
        },
        
        move_tab_to_index = ( tab_id, tab_index ) => {
            return new Promise( ( resolve, reject ) => {
                chrome.tabs.move( tab_id, {
                    index : tab_index,
                }, ( tab ) => {
                    resolve( tab );
                } );
            } );
        },
        
        start_tab_sorting = ( request_id, sorted_tab_id_list, sorted_tab_index_list ) => {
            Promise.all( sorted_tab_id_list.map( ( tab_id, index ) => {
                return move_tab_to_index( tab_id, sorted_tab_index_list[ index ] );
            } ) ).then( ( tab_list ) => {
                /*
                //chrome.tabs.update( sorted_tab_id_list[ 0 ], {
                //    active : true,
                //}, ( tab ) => {
                //    finish( request_id, sorted_tab_id_list );
                //    return;
                //} );
                //※能動的にはタブをアクティブにしない（ブラウザ設定依存とする）
                //  Firefox → browser.tabs.loadDivertedInBackground
                */
                
                finish( request_id, sorted_tab_id_list );
            } );
        },
        
        finish = ( request_id, sorted_tab_id_list ) => {
            sorted_tab_id_list.forEach( ( tab_id ) => {
                var callback = callback_map[ tab_id ];
                
                if ( typeof callback == 'function' ) {
                    callback();
                }
                delete callback_map[ tab_id ];
            } );
            
            delete sort_index_to_tab_id_map_map[ request_id ];
        };
        
    return ( tab_id, request_id, total, sort_index, callback ) => {
        var sort_index_to_tab_id_map = sort_index_to_tab_id_map_map[ request_id ] = sort_index_to_tab_id_map_map[ request_id ] || {};
        
        sort_index_to_tab_id_map[ sort_index ] = tab_id;
        callback_map[ tab_id ] = callback;
        
        if ( Object.keys( sort_index_to_tab_id_map ).length < total ) {
            return;
        }
        
        var sorted_tab_id_list = Object.keys( sort_index_to_tab_id_map ).sort().map( sort_index => sort_index_to_tab_id_map[ sort_index ] );
        
        Promise.all( sorted_tab_id_list.map( get_tab_index ) )
        .then( ( tab_index_list ) => {
            var sorted_tab_index_list = tab_index_list.slice( 0 ).sort();
            
            start_tab_sorting( request_id, sorted_tab_id_list, sorted_tab_index_list );
        } );
    };
} )(); // end of request_tab_sorting()


function on_message( message, sender, sendResponse ) {
    log_debug( '*** on_message():', message, sender );
    
    var type = message.type,
        response = null,
        tab_id = sender.tab && sender.tab.id;
    
    switch ( type ) {
        case 'GET_OPTIONS':
            var names = message.names,
                namespace = message.namespace;
            
            response = {};
            
            if ( typeof names == 'string' ) {
                names = [ names ];
            }
            
            Array.apply( null, names ).forEach( function( name ) {
                name = String( name );
                response[ name ] = localStorage[ ( ( namespace ) ? ( String( namespace ) + '_' ) : '' ) + name ];
            } );
            break;
        
        case 'RESET_CONTEXT_MENU':
            initialize( 'onMessage' );
            break;
        
        case 'CLOSE_TAB_REQUEST':
            if ( is_firefox() ) {
                // Firefox以外では、途中でタブを削除してしまうと、うまくダウンロードできない場合がある
                try {
                    chrome.tabs.remove( sender.tab.id, function () {
                        log_debug( type, 'OK' );
                    } );
                }
                catch ( error ) {
                    log_error( type, error );
                }
            }
            break;
        
        case 'RELOAD_TABS':
            reload_tabs();
            break;
        
        case 'NOTIFICATION_ONLOAD' :
            log_debug( 'NOTIFICATION_ONLOAD: tab_id', tab_id, message );
            if ( tab_id ) {
                CONTENT_TAB_INFOS[ tab_id ] = Object.assign( message.info, {
                    tab_id : tab_id,
                } );
            }
            log_debug( '=> CONTENT_TAB_INFOS', CONTENT_TAB_INFOS );
            break;
        
        case 'NOTIFICATION_ONUNLOAD' :
            log_debug( 'NOTIFICATION_ONUNLOAD: tab_id', tab_id, message );
            if ( tab_id ) {
                delete CONTENT_TAB_INFOS[ tab_id ];
            }
            log_debug( '=> CONTENT_TAB_INFOS', CONTENT_TAB_INFOS );
            break;
        
        case 'TAB_SORT_REQUEST' :
            log_debug( 'TAB_SORT_REQUEST: tab_id', tab_id, message );
            if ( tab_id ) {
                request_tab_sorting( tab_id, message.request_id, message.total, message.sort_index, () => {
                    sendResponse( {
                        result : 'OK',
                    } );
                } );
            }
            return true;
        
        default:
            break;
    }
    
    sendResponse( response );
    log_debug( response );
    
    return true;
}  // end of on_message()


function on_click( info, tab ) {
    log_debug( '*** on_click():', info, tab );
    
    update_context_menu_flags();
    
    if ( ( ! CONTEXT_MENU_IS_VISIBLE ) || CONTEXT_MENU_IS_SUSPENDED ) {
        return;
    }
    
    switch ( info.menuItemId ) {
        case DOWNLOAD_MENU_ID :
            download_image( info, tab );
            break;
        default :
            break;
    }
} // end of on_click()


function on_startup() {
    log_debug( '*** on_startup()' );
    
    initialize( 'onStartup' );
} // end of on_startup()


function on_installed( details ) {
    log_debug( '*** on_installed():', details );
    
    initialize( 'onInstalled' );
    
    //reload_tabs();
} // end of on_installed()


// ■ 各種イベント設定
// [chrome.runtime - Google Chrome](https://developer.chrome.com/extensions/runtime)
// [chrome.contextMenus - Google Chrome](https://developer.chrome.com/extensions/contextMenus)

// メッセージ受信
chrome.runtime.onMessage.addListener( on_message );

// クリックイベント(コンテキストメニュー)
chrome.contextMenus.onClicked.addListener( on_click );

// Installed イベント
chrome.runtime.onInstalled.addListener( on_installed );

// Startup イベント
if ( chrome.runtime.onStartup ) {
    chrome.runtime.onStartup.addListener( on_startup );
}

// DeterminingFilename イベント
// TODO: 副作用（他拡張機能との競合）が大きいため、保留(0.1.7.1702)
//chrome.downloads.onDeterminingFilename.addListener( on_determining_filename );

// Changed イベント
// ※ダウンロード状態を監視して、ダウンロード用に開いたタブを閉じる
chrome.downloads.onChanged.addListener( on_changed );

} )( window, document );

// ■ end of file
