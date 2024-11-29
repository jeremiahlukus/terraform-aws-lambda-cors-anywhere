locals {
  module_abs_path = path.module
  dist_path       = "${local.module_abs_path}/../../dist"
  package_path    = "${local.dist_path}/bootstrap.zip"
}

data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = local.dist_path
  output_path = local.package_path
}

resource "aws_lambda_function" "main" {
  filename         = local.package_path
  function_name    = var.function_name
  role             = aws_iam_role.role.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.lambda.output_base64sha256
  runtime          = "nodejs18.x"
  environment {
    variables = {
      PORT = 8080
    }
  }
}

resource "aws_lambda_function_url" "main" {
  function_name      = aws_lambda_function.main.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = false
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["*"]
    expose_headers    = ["*"]
    max_age          = 86400
  }
}

resource "aws_lambda_permission" "allow_invoke" {
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.main.arn
  principal              = "*"
  function_url_auth_type = aws_lambda_function_url.url.authorization_type
}
