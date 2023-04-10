# Crispy Coconut Backend

## 项目介绍

这是Crispy Coconut项目的后端服务代码仓库。

> Crispy Coconut是一款匿名提问箱App，该项目为2023年@CatlessFish与@Row11n二人合作完成的春季复旦大学移动互联网课程项目。
>
> 前端App代码仓库：[CatlessFish/crispy-coconut (github.com)](https://github.com/CatlessFish/crispy-coconut)
>
> 满足测试API规范：[zyz9740/ApiDoc (github.com)](https://github.com/zyz9740/ApiDoc)



## 食用指南

### Prerequisite

- 已安装MongoDB
- 已安装npm



### 启动服务

1. 克隆本仓库，进入本目录
2. 执行`npm install`安装依赖
3. 按照`.env.example`的示例创建并填写`.env`环境变量文件
4. 使用`npm run dev`（需要已安装`nodemon`，可实现保存文件后自动重启node）或`npm run start`，将在本地3000端口运行服务



### 运行测试

- 开发环境下，推荐使用VSCode插件`Rest Client`进行测试
- 当然，使用Postman等工具也是可以滴



## 工程目录结构

```
.
├── Dockerfile								用于打包Docker
├── README.md									本文档
├── app.js										应用配置
├── bin
│   └── www										用于启动应用的入口
├── config.js									用于.env环境变量配置
├── db												数据库模型相关
│   ├── models.js
│   └── user
│       └── user_model.js
├── middleware								中间件
│   └── auth.js
├── package-lock.json
├── package.json
├── routes										路由控制器
│   ├── api.js
│   ├── index.js
│   └── user.js
├── .env											环境配置，不应被git跟踪
└── .env.example							环境配置示例
```

