package mongo

import (
	"context"
	"drive-worker/internal/models"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Client struct {
	client *mongo.Client
	db     *mongo.Database
}

func Connect(ctx context.Context, uri string) (*Client, error) {
	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Ping to verify connection
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	db := client.Database("torrent-hunt")
	return &Client{client: client, db: db}, nil
}

func (c *Client) Close(ctx context.Context) error {
	return c.client.Disconnect(ctx)
}

func (c *Client) GetUser(ctx context.Context, userID string) (*models.UserDoc, error) {
	coll := c.db.Collection("users")
	var user models.UserDoc
	err := coll.FindOne(ctx, bson.M{"auth0Id": userID}).Decode(&user)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return &user, nil
}

func (c *Client) UpdateTask(ctx context.Context, taskID, status, driveFileID string) error {
	coll := c.db.Collection("tasks")
	update := bson.M{
		"$set": bson.M{
			"status":      status,
			"driveFileId": driveFileID,
			"updatedAt":   time.Now(),
		},
	}
	_, err := coll.UpdateOne(ctx, bson.M{"_id": taskID}, update)
	if err != nil {
		return fmt.Errorf("failed to update task: %w", err)
	}
	return nil
}

func (c *Client) InsertDownload(ctx context.Context, taskID, userID, driveFileID string) error {
	coll := c.db.Collection("downloads")
	doc := bson.M{
		"taskId":      taskID,
		"userId":      userID,
		"driveFileId": driveFileID,
		"createdAt":   time.Now(),
	}
	_, err := coll.InsertOne(ctx, doc)
	if err != nil {
		return fmt.Errorf("failed to insert download: %w", err)
	}
	return nil
}
