from sqlalchemy import JSON, Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = 'user'
    
    userid = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    
    # Relationships
    requested_events = relationship('RequestedEvent', back_populates='tutee', foreign_keys='RequestedEvent.userid_tutee')
    tutor_events = relationship('RequestedEvent', back_populates='tutor', foreign_keys='RequestedEvent.userid_tutor')
    
    def __repr__(self):
        return f"<User(userid={self.userid}, email='{self.email}', name='{self.name}')>"


class Subject(Base):
    __tablename__ = 'subjects'
    
    subject = Column(String(255), nullable=False, unique=True, primary_key=True)
    
    def __repr__(self):
        return f"<Subject(subject='{self.subject}')>"


class RequestedEvent(Base):
    __tablename__ = 'requested_event'
    
    eventid = Column(Integer, primary_key=True, autoincrement=True)
    userid_tutee = Column(Integer, ForeignKey('user.userid'), nullable=False, index=True)
    available_start_time = Column(DateTime, nullable=False)
    available_end_time = Column(DateTime, nullable=False)
    category = Column(String(255), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    userid_tutor = Column(Integer, ForeignKey('user.userid'), nullable=True, index=True)
    possible_tutors = Column(JSON,nullable = True)  # JSON string of possible tutor IDs
    is_accepted = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    
    # Relationships
    tutee = relationship('User', back_populates='requested_events', foreign_keys=[userid_tutee])
    tutor = relationship('User', back_populates='tutor_events', foreign_keys=[userid_tutor])
    meetings = relationship('Meeting', back_populates='event')
    
    def __repr__(self):
        return f"<RequestedEvent(eventid={self.eventid}, title='{self.title}', category='{self.category}')>"


class Meeting(Base):
    __tablename__ = 'meeting'
    
    eventid = Column(Integer, ForeignKey('requested_event.eventid'), nullable=False, index=True, primary_key=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    
    # Relationship
    event = relationship('RequestedEvent', back_populates='meetings')
    
    def __repr__(self):
        return f"<Meeting(id={self.id}, eventid={self.eventid}, start_time={self.start_time})>"
