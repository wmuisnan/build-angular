# 《build your own angularjs》读书笔记

## 0  setting up
`todo:` 一个开发环境的搭建文档
把 `karma.config.js` 写成了 `karma.config` 卡半天。

## 第一部分 Scopes

Scopes are used for many different purposes:1. Sharing data between a controller/directive and its view template- Sharing data between different parts of the UI- Broadcasting and listening for events(这个很少用到啊).- Watching for changes in data.

----

In this first part of the book you will implement Angular scopes. We will cover four main areas of functionality:1. The core dirty-checking implementation itself, including `$watch` and `$digest`.2. The different ways of starting a digest: `$eval`, `$apply`, `$evalAsync`, and `$applyAsync`, andthe `$watchGroup` implementation for watching multiple things at once.3. Scope inheritance - the mechanism that makes it possible to create scope hierarchies for sharing data and events.4. Efficient dirty-checking for collections (arrays and objects).5. The event system: `$on`, `$emit`, and `$broadcast`.



### 第一章 Scopes and Dirty- Checking
#### Watching Object Properties: `$watch` And `$digest`

 `$watch` and `$digest` are two sides of the same coin. Together they form the core of what the digest cycle is all about: Reacting to changes in data.
 
 `one side:` With `$watch` you can attach something called a watcher to a scope. A watcher is something that is notified when a change occurs on the scope. You can create a watcher by calling `$watch` with two arguments, both of which should be functions: (注册一个变化监听函数)
 
 - A watch function, which specifies the piece of data you’re interested in.(指定需要监听的数据) - A listener function which will be called whenever that data changes.（监听的数据有变化后会调用此函数）

>  watch 有 
> 	1. watch 表达式，在模板里绑定的 'user.name'之类， 
> 	2. watch function 
> 	两种。

`The other side` of the coin is the `$digest` function. It iterates over all the watchers that have been attached on the scope, and runs their watch and listener functions accordingly.（提供一个检查是有有变化的方法）

