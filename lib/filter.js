/*!
 * Cabinet file filters
 * Copyright(c) 2012 Optimal Bits Sweden AB.
 * MIT Licensed
 */
 
 var _ = require('underscore');
 
 module.exports.compileFilters = function(options){
   var results = [];
  
   compileFilter('less', options, results);
   compileFilter('coffee', options, results);
   compileFilter('minjs', options, results);
   compileFilter('gzip', options, results);
  
   return results;
 }

 module.exports.applyFilters = function(filters, req, res, next, path, options, cb){
   var headers = _.clone(req.headers), type = mime.lookup(path);

   applyFilter(filters, 0, headers, path, type, res, null, function(err, data){
     if(!err && data){
       res.setHeader('Content-Length', data.length);
       res.write(data);
       res.end();
     }
     cb(err, data);
   })
 }

 var filters = {};
 
//
// Gzip
//
filters.gzip = function gzip(options){
  var zlib = require('zlib');
  
  return function(res, data, cb){
    zlib.gzip(data, function(err, compressed){
      if(err){
        cb(err);
      }else{
        res.setHeader('Content-Encoding', 'gzip');
        cb(null, compressed);
      }
    });
  }
}

filters.gzip.check = function(headers, path, type){
  return ((type.match('text') || type.match('javascript')) &&
          headers['accept-encoding'].match('gzip'));
}

//
// Less CSS
//
filters.less = function less(options){
  var 
    less = require('less'),
    parser = new(less.Parser)(options);
  
  return function(res, data, cb){
    lessParser.parse(data, function(err, tree) {
      if(err){
        cb(err);
      }else{
        res.setHeader("Content-type", "text/css");
        cb(null, tree.toCSS());
      }
    });
  };
}

filters.less.check = function (headers, path, type){
  return path.match('.less');
}

//
// Coffee Script
//
filters.coffee = function coffee(options){
  var coffee = require('coffee-script');
  
  return function(res, data, cb){
    res.setHeader("Content-type", "text/javascript");
    cb(null, coffee.compile(data));
  }
}

filters.coffee.check = function(headers, path, type){
  return (path.indexOf("coffee")!==-1);
}

//
// UglifyJS
//
filters.minjs = function minjs(options){
  var
    uglify = require('uglify-js'),
    jsp = uglify.parser, 
    pro = uglify.uglify;
    
  return function(res, data, cb){
    var ast = jsp.parse(data);
    ast = pro.ast_mangle(ast);
    ast = pro.ast_squeeze(ast);
    cb(null, pro.gen_code(ast));
  }
}

filters.minjs.check = function(headers, path, type){
  console.log(headers['content-type'])
  
  return (path.indexOf("min")==-1) && 
  		   (type.match('javascript') || headers['content-type'].match('javascript'));
}

//
// 
//
function applyFilter(arr, index, headers, path, type, res, data, cb){  
  var filter = arr[index++];
  
  if(!filter) return cb(null, data);
  
  _.extend(headers, res._headers);
  if(filter.check(headers, path, type)){
    if(data){
      filter(res, data, function(err, data){
        if(!err && data){
          applyFilter(arr, index, headers, path, type, res, data, cb);
        }else{
          cb(err);
        }
      });
    }else{
      fs.readFile(path, 'utf-8', function(err, data){
        filter(res, data, function(err, data){
          if(!err && data){
            applyFilter(arr, index, headers, path, type, res, data, cb);
          }else{
            cb(err);
          }
        });
      });
    }
  }else{
    applyFilter(arr, index, headers, path, type, res, data, cb);
  }
}

function compileFilter(name, options, results){
  if(options[name]){
    var f = filters[name](options);
    f.check = filters[name].check;
    results.push(f);
  }
}
